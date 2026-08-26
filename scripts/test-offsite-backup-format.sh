#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORMAT="$ROOT/scripts/offsite-backup-format.sh"
command -v bash >/dev/null 2>&1 || { echo 'bash is required' >&2; exit 3; }
command -v gpg >/dev/null 2>&1 || { echo 'gpg is required' >&2; exit 3; }
command -v sqlite3 >/dev/null 2>&1 || { echo 'sqlite3 is required' >&2; exit 3; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
KEY="$TMP/key"
WRONG_KEY="$TMP/wrong-key"
DB="$TMP/source.db"
OBJECT_NAME='rtbackup-20260825-1200.db.v2.gpg'
ENC="$TMP/$OBJECT_NAME"
OUT="$TMP/out.db"
CASE_SEQ=0

printf 'test-passphrase\n' > "$KEY"
printf 'wrong-passphrase\n' > "$WRONG_KEY"
chmod 600 "$KEY" "$WRONG_KEY"
sqlite3 "$DB" 'CREATE TABLE smoke(value TEXT); INSERT INTO smoke VALUES ("ok");'

pass_case() { printf 'PASS %s\n' "$1"; }

expect_fail_status() {
  local expected="$1"
  shift
  CASE_SEQ=$((CASE_SEQ + 1))
  local output="$TMP/failure-${CASE_SEQ}.log"
  if "$@" >"$output" 2>&1; then
    echo "unexpected success: $*" >&2
    exit 1
  fi
  if ! grep -Fq "$expected" "$output"; then
    echo "missing failure status $expected from: $*" >&2
    sed -n '1,80p' "$output" >&2
    exit 1
  fi
}

reencrypt_changed_manifest() {
  local source="$1" destination="$2" expression="$3"
  local payload="$TMP/rewrite.payload" inner="$TMP/rewrite.inner" changed="$TMP/rewrite.changed"
  dd if="$source" of="$payload" bs=1 skip=12 status=none
  gpg --batch --yes --no-options --no-keyring --pinentry-mode loopback \
    --passphrase-file "$KEY" --decrypt --output "$inner" "$payload"
  sed "$expression" "$inner" > "$changed"
  gpg --batch --yes --no-options --no-keyring --pinentry-mode loopback \
    --passphrase-file "$KEY" --symmetric --cipher-algo AES256 --force-ocb \
    --compress-algo none --output "$payload.gpg" "$changed"
  {
    printf 'RTBACKUP-V2\n'
    cat "$payload.gpg"
  } > "$destination"
  chmod 600 "$destination"
}

"$FORMAT" encrypt "$DB" "$ENC" "$KEY" "$OBJECT_NAME"

# The outer header is exactly 12 bytes. Command substitution is deliberately
# avoided because it strips trailing LF bytes and caused the original test bug.
test "$(dd if="$ENC" bs=1 count=12 status=none | od -An -tx1 -v | tr -d ' \n')" \
  = '52544241434b55502d56320a'
pass_case EXACT_HEADER

"$FORMAT" decrypt "$ENC" "$OUT" "$KEY"
test "$(sqlite3 "$OUT" 'PRAGMA integrity_check;')" = ok
pass_case VALID_V2

dd if="$ENC" of="$TMP/packet.gpg" bs=1 skip=12 status=none
PACKETS="$(gpg --batch --no-options --no-keyring --pinentry-mode loopback \
  --passphrase-file "$KEY" --list-packets "$TMP/packet.gpg" 2>&1)"
grep -Fq ':symkey enc packet: version 5, cipher 9, aead 2' <<<"$PACKETS"
grep -Fq ':aead encrypted packet: cipher=9 aead=2' <<<"$PACKETS"
pass_case AEAD_OCB_PACKET_PROOF

cp "$ENC" "$TMP/ciphertext-tamper.gpg"
printf '\001' | dd of="$TMP/ciphertext-tamper.gpg" bs=1 seek=48 conv=notrunc status=none
expect_fail_status AUTHENTICITY_FAILED "$FORMAT" decrypt \
  "$TMP/ciphertext-tamper.gpg" "$TMP/ciphertext-tamper.db" "$KEY"
pass_case CIPHERTEXT_TAMPER

expect_fail_status AUTHENTICITY_FAILED "$FORMAT" decrypt "$ENC" "$TMP/wrong.db" "$WRONG_KEY"
pass_case WRONG_KEY

head -c -1 "$ENC" > "$TMP/truncated.gpg"
expect_fail_status AUTHENTICITY_FAILED "$FORMAT" decrypt \
  "$TMP/truncated.gpg" "$TMP/truncated.db" "$KEY"
pass_case TRUNCATION

cp "$ENC" "$TMP/header-tamper.gpg"
printf 'X' | dd of="$TMP/header-tamper.gpg" bs=1 seek=0 conv=notrunc status=none
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/header-tamper.gpg" "$TMP/header.db" "$KEY"
pass_case HEADER_TAMPER

cp "$ENC" "$TMP/header-nul.gpg"
printf '\000' | dd of="$TMP/header-nul.gpg" bs=1 seek=11 conv=notrunc status=none
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/header-nul.gpg" "$TMP/nul.db" "$KEY"
pass_case HEADER_NUL

cp "$ENC" "$TMP/header-crlf.gpg"
printf '\r' | dd of="$TMP/header-crlf.gpg" bs=1 seek=11 conv=notrunc status=none
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/header-crlf.gpg" "$TMP/crlf.db" "$KEY"
pass_case HEADER_CRLF_REJECTED

printf 'RTBACKUP-V2' > "$TMP/header-prefix.gpg"
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/header-prefix.gpg" "$TMP/prefix.db" "$KEY"
pass_case HEADER_PREFIX_ONLY

head -c 7 "$ENC" > "$TMP/header-truncated.gpg"
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/header-truncated.gpg" "$TMP/header-short.db" "$KEY"
pass_case HEADER_TRUNCATED

{
  head -c 11 "$ENC"
  printf 'X\n'
  tail -c +13 "$ENC"
} > "$TMP/header-extra.gpg"
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/header-extra.gpg" "$TMP/header-extra.db" "$KEY"
pass_case HEADER_EXTRA_BYTE

cp "$ENC" "$TMP/rtbackup-20990101-0000.db.v2.gpg"
expect_fail_status BACKUP_IDENTITY_MISMATCH "$FORMAT" decrypt \
  "$TMP/rtbackup-20990101-0000.db.v2.gpg" "$TMP/future.db" "$KEY"
pass_case FUTURE_RENAME_REPLAY

cp "$ENC" "$TMP/rtbackup-20260826-1200.db.v2.gpg"
expect_fail_status BACKUP_IDENTITY_MISMATCH "$FORMAT" decrypt \
  "$TMP/rtbackup-20260826-1200.db.v2.gpg" "$TMP/current-looking.db" "$KEY"
pass_case OLD_BACKUP_CURRENT_NAME_REPLAY

mkdir "$TMP/backup-id-invalid" "$TMP/created-invalid"
reencrypt_changed_manifest "$ENC" "$TMP/backup-id-invalid/$OBJECT_NAME" \
  's/^BACKUP_ID=20260825-1200$/BACKUP_ID=20250825-1200/'
expect_fail_status BACKUP_IDENTITY_MISMATCH "$FORMAT" decrypt \
  "$TMP/backup-id-invalid/$OBJECT_NAME" "$TMP/backup-id-invalid.db" "$KEY"
pass_case INTERNAL_BACKUP_ID_MISMATCH

reencrypt_changed_manifest "$ENC" "$TMP/created-invalid/$OBJECT_NAME" \
  's/^CREATED_AT_UTC=2026-08-25T12:00:00Z$/CREATED_AT_UTC=2025-08-25T12:00:00Z/'
expect_fail_status BACKUP_IDENTITY_MISMATCH "$FORMAT" decrypt \
  "$TMP/created-invalid/$OBJECT_NAME" "$TMP/created-invalid.db" "$KEY"
pass_case INTERNAL_TIMESTAMP_NAME_MISMATCH

printf 'not sqlite' > "$TMP/corrupt.db"
CORRUPT_NAME='rtbackup-20260825-1201.db.v2.gpg'
"$FORMAT" encrypt "$TMP/corrupt.db" "$TMP/$CORRUPT_NAME" "$KEY" "$CORRUPT_NAME"
"$FORMAT" decrypt "$TMP/$CORRUPT_NAME" "$TMP/corrupt.out" "$KEY"
if integrity="$(sqlite3 "$TMP/corrupt.out" 'PRAGMA integrity_check;' 2>/dev/null)" \
    && [ "$integrity" = ok ]; then
  echo 'corrupt authenticated SQLite unexpectedly passed integrity_check' >&2
  exit 1
fi
pass_case AUTHENTICATED_BUT_CORRUPT_SQLITE

printf 'legacy-ciphertext' > "$TMP/rtbackup-20260825-1200.db.enc"
expect_fail_status LEGACY_UNAUTHENTICATED "$FORMAT" decrypt \
  "$TMP/rtbackup-20260825-1200.db.enc" "$TMP/legacy.db" "$KEY"
pass_case LEGACY_V1

: > "$TMP/empty.gpg"
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/empty.gpg" "$TMP/empty.db" "$KEY"
pass_case EMPTY_FILE

dd if=/dev/urandom of="$TMP/random.gpg" bs=64 count=1 status=none
expect_fail_status FORMAT_NOT_V2 "$FORMAT" decrypt "$TMP/random.gpg" "$TMP/random.db" "$KEY"
pass_case RANDOM_GPG_FILE

echo 'offsite V2 AES256/OCB manipulation tests passed'
