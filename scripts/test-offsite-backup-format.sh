#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORMAT="$ROOT/scripts/offsite-backup-format.sh"
command -v sqlite3 >/dev/null 2>&1 || { echo 'sqlite3 is required for the restore-format test' >&2; exit 3; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
KEY="$TMP/key"
WRONG_KEY="$TMP/wrong-key"
DB="$TMP/source.db"
ENC="$TMP/backup.v2.gpg"
OUT="$TMP/out.db"
printf 'test-passphrase\n' > "$KEY"
printf 'wrong-passphrase\n' > "$WRONG_KEY"
chmod 600 "$KEY" "$WRONG_KEY"
sqlite3 "$DB" 'CREATE TABLE smoke(value TEXT); INSERT INTO smoke VALUES ("ok");'

"$FORMAT" encrypt "$DB" "$ENC" "$KEY"
test "$(head -c 12 "$ENC")" = $'RTBACKUP-V2\n'
"$FORMAT" decrypt "$ENC" "$OUT" "$KEY"
test "$(sqlite3 "$OUT" 'PRAGMA integrity_check;')" = ok

expect_fail() { if "$@" >/dev/null 2>&1; then echo "unexpected success: $*" >&2; exit 1; fi; }

cp "$ENC" "$TMP/byteflip"
printf '\001' | dd of="$TMP/byteflip" bs=1 seek=40 conv=notrunc status=none
expect_fail "$FORMAT" decrypt "$TMP/byteflip" "$TMP/byteflip.db" "$KEY"

cp "$ENC" "$TMP/headerflip"
printf 'X' | dd of="$TMP/headerflip" bs=1 seek=0 conv=notrunc status=none
expect_fail "$FORMAT" decrypt "$TMP/headerflip" "$TMP/headerflip.db" "$KEY"

head -c -1 "$ENC" > "$TMP/truncated"
expect_fail "$FORMAT" decrypt "$TMP/truncated" "$TMP/truncated.db" "$KEY"
expect_fail "$FORMAT" decrypt "$ENC" "$TMP/wrong.db" "$WRONG_KEY"
: > "$TMP/empty"
expect_fail "$FORMAT" decrypt "$TMP/empty" "$TMP/empty.db" "$KEY"

# Authenticated but corrupt plaintext: authentication succeeds, SQLite must fail.
printf 'not sqlite' > "$TMP/corrupt.db"
"$FORMAT" encrypt "$TMP/corrupt.db" "$TMP/corrupt.v2.gpg" "$KEY"
"$FORMAT" decrypt "$TMP/corrupt.v2.gpg" "$TMP/corrupt.out" "$KEY"
test "$(sqlite3 "$TMP/corrupt.out" 'PRAGMA integrity_check;' 2>/dev/null || true)" != ok

echo 'offsite V2 format manipulation tests passed'
