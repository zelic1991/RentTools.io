#!/usr/bin/env bash
# Versioned authenticated offsite-backup container.
# V2 uses GnuPG AES-256/OCB and an authenticated, fixed-layout inner manifest.
# V1 OpenSSL-CBC objects are intentionally not handled here.
set -euo pipefail

FORMAT_MAGIC='RTBACKUP-V2'
FORMAT_HEADER_HEX='52544241434b55502d56320a'
FORMAT_HEADER_SIZE=12
INNER_MAGIC='RTBACKUP-INNER-V2'
MIN_GPG_VERSION='2.4.4'

private_key_file() {
  local path="$1"
  [ -r "$path" ] || { echo "KEY_UNREADABLE" >&2; return 1; }
  local mode
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" =~ ^[46]00$ ]] || { echo "KEY_PERMISSIONS" >&2; return 1; }
}

require_ocb_support() {
  command -v gpg >/dev/null 2>&1 || { echo "GPG_REQUIRED" >&2; return 1; }
  gpg --dump-options | grep -Fqx -- '--force-ocb' || {
    echo "GPG_OCB_UNSUPPORTED: minimum tested recovery version is $MIN_GPG_VERSION" >&2
    return 1
  }
}

derive_identity() {
  local object_name="$1"
  [[ "$object_name" =~ ^rtbackup-([0-9]{8})-([0-9]{4})\.db\.v2\.gpg$ ]] || {
    echo "BACKUP_OBJECT_NAME_INVALID" >&2
    return 1
  }
  local date_part="${BASH_REMATCH[1]}" time_part="${BASH_REMATCH[2]}"
  DERIVED_BACKUP_ID="${date_part}-${time_part}"
  DERIVED_CREATED_AT="${date_part:0:4}-${date_part:4:2}-${date_part:6:2}T${time_part:0:2}:${time_part:2:2}:00Z"
  [ "$(date -u -d "$DERIVED_CREATED_AT" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null)" = "$DERIVED_CREATED_AT" ] || {
    echo "BACKUP_CREATED_AT_INVALID" >&2
    return 1
  }
}

write_manifest() {
  local destination="$1" backup_id="$2" created_at="$3" object_name="$4" db_hash="$5" db_size="$6"
  {
    printf '%s\n' "$INNER_MAGIC"
    printf 'FORMAT_VERSION=2\n'
    printf 'BACKUP_ID=%s\n' "$backup_id"
    printf 'CREATED_AT_UTC=%s\n' "$created_at"
    printf 'OBJECT_NAME_BINDING=%s\n' "$object_name"
    printf 'DB_SHA256=%s\n' "$db_hash"
    printf 'DB_SIZE=%s\n' "$db_size"
    printf '\n'
  } > "$destination"
}

assert_ocb_packet() {
  local encrypted_payload="$1" key_file="$2" packet_report
  if ! packet_report="$(gpg --batch --no-options --no-keyring --pinentry-mode loopback \
      --passphrase-file "$key_file" --list-packets "$encrypted_payload" 2>&1)"; then
    echo "AEAD_PACKET_PROOF_FAILED" >&2
    return 1
  fi
  grep -Fq ':aead encrypted packet: cipher=9 aead=2' <<<"$packet_report" || {
    echo "CRYPTO_MODE_NOT_AES256_OCB" >&2
    return 1
  }
}

exact_outer_header() {
  local source="$1" actual_hex
  [ "$(stat -c '%s' "$source")" -gt "$FORMAT_HEADER_SIZE" ] || return 1
  actual_hex="$(dd if="$source" bs=1 count="$FORMAT_HEADER_SIZE" status=none \
    | od -An -tx1 -v | tr -d ' \n')"
  [ "$actual_hex" = "$FORMAT_HEADER_HEX" ]
}

encrypt_v2() {
  local source="$1" destination="$2" key_file="$3" object_name="$4"
  local inner payload manifest db_hash db_size
  private_key_file "$key_file"
  require_ocb_support
  [ -f "$source" ] || { echo "SOURCE_MISSING" >&2; return 1; }
  derive_identity "$object_name"
  db_hash="$(sha256sum "$source" | awk '{print $1}')"
  db_size="$(stat -c '%s' "$source")"
  inner="$(mktemp "${destination}.inner.XXXXXX")"
  payload="$(mktemp "${destination}.payload.XXXXXX")"
  manifest="$(mktemp "${destination}.manifest.XXXXXX")"
  trap 'rm -f "${inner:-}" "${payload:-}" "${manifest:-}"' RETURN

  write_manifest "$manifest" "$DERIVED_BACKUP_ID" "$DERIVED_CREATED_AT" \
    "$object_name" "$db_hash" "$db_size"
  {
    cat "$manifest"
    cat "$source"
  } > "$inner"

  gpg --batch --yes --no-options --no-keyring --pinentry-mode loopback \
    --passphrase-file "$key_file" --symmetric --cipher-algo AES256 \
    --force-ocb --compress-algo none --output "$payload" "$inner"
  assert_ocb_packet "$payload" "$key_file"
  {
    printf '%s\n' "$FORMAT_MAGIC"
    cat "$payload"
  } > "$destination"
  chmod 600 "$destination"
}

decrypt_v2() {
  local source="$1" destination="$2" key_file="$3"
  local payload clear manifest db_tmp actual_name
  local inner_magic format_version backup_id created_at object_name db_hash db_size separator
  private_key_file "$key_file"
  require_ocb_support
  [ -f "$source" ] || { echo "SOURCE_MISSING" >&2; return 1; }
  if [[ "$(basename "$source")" == *.db.enc ]]; then
    echo "LEGACY_UNAUTHENTICATED" >&2
    return 1
  fi
  exact_outer_header "$source" || { echo "FORMAT_NOT_V2" >&2; return 1; }

  payload="$(mktemp "${destination}.payload.XXXXXX")"
  clear="$(mktemp "${destination}.clear.XXXXXX")"
  manifest="$(mktemp "${destination}.manifest.XXXXXX")"
  db_tmp="$(mktemp "${destination}.db.XXXXXX")"
  trap 'rm -f "${payload:-}" "${clear:-}" "${manifest:-}" "${db_tmp:-}"' RETURN
  dd if="$source" of="$payload" bs=1 skip="$FORMAT_HEADER_SIZE" status=none
  [ -s "$payload" ] || { echo "PAYLOAD_EMPTY" >&2; return 1; }

  # Nothing in the inner format is read before this AEAD authentication step.
  if ! gpg --batch --yes --no-options --no-keyring --pinentry-mode loopback \
      --passphrase-file "$key_file" --decrypt --output "$clear" "$payload"; then
    echo "AUTHENTICITY_FAILED" >&2
    return 1
  fi

  {
    IFS= read -r inner_magic
    IFS= read -r format_version
    IFS= read -r backup_id
    IFS= read -r created_at
    IFS= read -r object_name
    IFS= read -r db_hash
    IFS= read -r db_size
    IFS= read -r separator
  } < "$clear" || { echo "INNER_MANIFEST_TRUNCATED" >&2; return 1; }

  [ "$inner_magic" = "$INNER_MAGIC" ] \
    && [ "$format_version" = 'FORMAT_VERSION=2' ] \
    && [[ "$backup_id" =~ ^BACKUP_ID=([0-9]{8}-[0-9]{4})$ ]] \
    && [[ "$created_at" =~ ^CREATED_AT_UTC=([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00Z)$ ]] \
    && [[ "$object_name" =~ ^OBJECT_NAME_BINDING=(rtbackup-[0-9]{8}-[0-9]{4}\.db\.v2\.gpg)$ ]] \
    && [[ "$db_hash" =~ ^DB_SHA256=([0-9a-f]{64})$ ]] \
    && [[ "$db_size" =~ ^DB_SIZE=(0|[1-9][0-9]*)$ ]] \
    && [ -z "$separator" ] || { echo "INNER_MANIFEST_INVALID" >&2; return 1; }

  backup_id="${backup_id#BACKUP_ID=}"
  created_at="${created_at#CREATED_AT_UTC=}"
  object_name="${object_name#OBJECT_NAME_BINDING=}"
  db_hash="${db_hash#DB_SHA256=}"
  db_size="${db_size#DB_SIZE=}"
  derive_identity "$object_name" || { echo "BACKUP_IDENTITY_MISMATCH" >&2; return 1; }
  actual_name="$(basename "$source")"
  if [ "$actual_name" != "$object_name" ] \
      || [ "$backup_id" != "$DERIVED_BACKUP_ID" ] \
      || [ "$created_at" != "$DERIVED_CREATED_AT" ]; then
    echo "BACKUP_IDENTITY_MISMATCH" >&2
    return 1
  fi

  write_manifest "$manifest" "$backup_id" "$created_at" "$object_name" "$db_hash" "$db_size"
  local manifest_size clear_size
  manifest_size="$(stat -c '%s' "$manifest")"
  clear_size="$(stat -c '%s' "$clear")"
  [ "$clear_size" -eq $((manifest_size + db_size)) ] \
    && cmp -s -n "$manifest_size" "$manifest" "$clear" || {
    echo "INNER_MANIFEST_INVALID" >&2
    return 1
  }

  dd if="$clear" of="$db_tmp" bs=1 skip="$manifest_size" count="$db_size" status=none
  [ "$(sha256sum "$db_tmp" | awk '{print $1}')" = "$db_hash" ] || {
    echo "DATABASE_PAYLOAD_HASH_MISMATCH" >&2
    return 1
  }
  chmod 600 "$db_tmp"
  mv -f "$db_tmp" "$destination"
}

case "${1:-}" in
  encrypt) [ "$#" -eq 5 ] && encrypt_v2 "$2" "$3" "$4" "$5" ;;
  decrypt) [ "$#" -eq 4 ] && decrypt_v2 "$2" "$3" "$4" ;;
  *) echo "usage: $0 encrypt SOURCE DESTINATION KEY_FILE OBJECT_NAME | decrypt SOURCE DESTINATION KEY_FILE" >&2; exit 64 ;;
esac
