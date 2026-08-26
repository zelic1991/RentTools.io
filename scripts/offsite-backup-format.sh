#!/usr/bin/env bash
# Versioned authenticated offsite-backup container.
# V2 uses GnuPG's AES-256 + MDC packet format. The plaintext is written only
# to a caller-provided temporary path; callers must use it only after gpg exits
# successfully. V1 OpenSSL-CBC objects are intentionally not handled here.
set -euo pipefail

FORMAT_MAGIC='RTBACKUP-V2'
FORMAT_HEADER="${FORMAT_MAGIC}"$'\n'

private_key_file() {
  local path="$1"
  [ -r "$path" ] || { echo "KEY_UNREADABLE" >&2; return 1; }
  local mode
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" =~ ^[46]00$ ]] || { echo "KEY_PERMISSIONS" >&2; return 1; }
}

encrypt_v2() {
  local source="$1" destination="$2" key_file="$3" payload
  private_key_file "$key_file"
  [ -f "$source" ] || { echo "SOURCE_MISSING" >&2; return 1; }
  payload="$(mktemp "${destination}.payload.XXXXXX")"
  trap 'rm -f "${payload:-}"' RETURN
  gpg --batch --yes --no-options --no-keyring --pinentry-mode loopback \
    --passphrase-file "$key_file" --symmetric --cipher-algo AES256 \
    --force-mdc --compress-algo none --output "$payload" "$source"
  {
    printf '%s' "$FORMAT_HEADER"
    cat "$payload"
  } > "$destination"
  chmod 600 "$destination"
}

decrypt_v2() {
  local source="$1" destination="$2" key_file="$3" payload
  private_key_file "$key_file"
  [ -f "$source" ] || { echo "SOURCE_MISSING" >&2; return 1; }
  [ "$(head -c "${#FORMAT_MAGIC}" "$source")" = "$FORMAT_MAGIC" ] \
    && [ "$(dd if="$source" bs=1 skip="${#FORMAT_MAGIC}" count=1 status=none)" = "" ] || {
    echo "FORMAT_NOT_V2" >&2; return 1;
  }
  payload="$(mktemp "${destination}.payload.XXXXXX")"
  trap 'rm -f "${payload:-}"' RETURN
  dd if="$source" of="$payload" bs=1 skip="${#FORMAT_HEADER}" status=none
  [ -s "$payload" ] || { echo "PAYLOAD_EMPTY" >&2; return 1; }
  # GPG verifies the MDC before returning success. Never use destination until
  # this command succeeds; a failed/tampered object is removed by the caller.
  gpg --batch --no-options --no-keyring --pinentry-mode loopback \
    --passphrase-file "$key_file" --decrypt --output "$destination" "$payload"
  chmod 600 "$destination"
}

case "${1:-}" in
  encrypt) [ "$#" -eq 4 ] && encrypt_v2 "$2" "$3" "$4" ;;
  decrypt) [ "$#" -eq 4 ] && decrypt_v2 "$2" "$3" "$4" ;;
  *) echo "usage: $0 encrypt|decrypt SOURCE DESTINATION KEY_FILE" >&2; exit 64 ;;
esac
