#!/bin/bash
# Download the newest encrypted Google Drive backup, decrypt it into a temporary
# directory, and verify SQLite integrity. The live database is never touched.

set -euo pipefail
umask 077

BACKUP_ROOT="${BACKUP_ROOT:-/home/app/backups}"
LOCK_FILE="${OFFSITE_RESTORE_LOCK_FILE:-$BACKUP_ROOT/.offsite-restore.lock}"
LOG_FILE="${OFFSITE_RESTORE_LOG_FILE:-/home/app/logs/rent-tool-offsite-restore.log}"
CONFIG_FILE="${OFFSITE_BACKUP_CONFIG_FILE:-/home/app/.renttools-offsite-backup.env}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { printf '[%s] %s %s\n' "$(ts)" "$1" "$2" | tee -a "$LOG_FILE" >&2; }

require_private_file() {
  local path="$1"
  local label="$2"
  local mode
  if [ ! -r "$path" ]; then
    log "FATAL" "$label is not readable"
    return 1
  fi
  mode="$(stat -c '%a' "$path")"
  if [[ ! "$mode" =~ ^[46]00$ ]]; then
    log "FATAL" "$label permissions must be 400 or 600"
    return 1
  fi
}

rclone_config_has_encrypted_header() {
  awk '
    NR > 10 { exit 1 }
    /^[[:space:]]*$/ || /^[[:space:]]*#/ { next }
    $0 == "RCLONE_ENCRYPT_V0:" { found = 1; exit 0 }
    { exit 1 }
    END { if (!found) exit 1 }
  ' "$1"
}

mkdir -p "$BACKUP_ROOT" "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "WARN" "another offsite restore drill is already running"
  exit 75
fi

if [ -f "$CONFIG_FILE" ]; then
  config_mode="$(stat -c '%a' "$CONFIG_FILE")"
  if [[ ! "$config_mode" =~ ^[46]00$ ]]; then
    log "FATAL" "offsite config permissions must be 400 or 600"
    exit 2
  fi
  set -a
  # shellcheck disable=SC1090 -- owner-managed path outside the repository
  . "$CONFIG_FILE"
  set +a
fi

if [ "${OFFSITE_BACKUP_ENABLED:-0}" != "1" ]; then
  log "INFO" "Google Drive offsite restore drill is disabled"
  exit 0
fi

RCLONE_CONFIG="${RCLONE_CONFIG:-/home/app/.config/rclone/rclone.conf}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive_offsite}"
RCLONE_REMOTE_DIR="${RCLONE_REMOTE_DIR:-RentTools-Backups}"
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-/home/app/.renttools-backup-pass}"
RCLONE_CONFIG_PASS_FILE="${RCLONE_CONFIG_PASS_FILE:-/home/app/.renttools-rclone-config-pass}"
PBKDF2_ITERATIONS="${PBKDF2_ITERATIONS:-200000}"

if ! command -v "$RCLONE_BIN" >/dev/null 2>&1 || ! command -v sqlite3 >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  log "FATAL" "rclone, sqlite3, and openssl are required"
  exit 3
fi
if ! require_private_file "$RCLONE_CONFIG" "rclone config"; then
  exit 4
fi
if [ "$(stat -c '%a' "$RCLONE_CONFIG")" != "600" ]; then
  log "FATAL" "rclone config must be mode 600 so OAuth tokens can refresh"
  exit 4
fi
if [[ ! "$PBKDF2_ITERATIONS" =~ ^[0-9]+$ ]] \
    || [ "$PBKDF2_ITERATIONS" -lt 200000 ]; then
  log "FATAL" "PBKDF2_ITERATIONS must be an integer of at least 200000"
  exit 4
fi

RCLONE_PASSWORD_ARGS=(--ask-password=false)
if [ -n "${RCLONE_CONFIG_PASS:-}" ]; then
  export RCLONE_CONFIG_PASS
elif require_private_file "$RCLONE_CONFIG_PASS_FILE" "rclone config-password file"; then
  RCLONE_PASSWORD_ARGS+=(--password-command "cat $RCLONE_CONFIG_PASS_FILE")
else
  log "FATAL" "no rclone config password secret is available"
  exit 4
fi

OPENSSL_PASSWORD_ARGS=()
if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  export BACKUP_ENCRYPTION_PASSPHRASE
  OPENSSL_PASSWORD_ARGS=(-pass env:BACKUP_ENCRYPTION_PASSPHRASE)
elif require_private_file "$BACKUP_ENCRYPTION_KEY_FILE" "backup-encryption key file"; then
  OPENSSL_PASSWORD_ARGS=(-pass "file:$BACKUP_ENCRYPTION_KEY_FILE")
else
  log "FATAL" "no backup-encryption secret is available"
  exit 4
fi

if [[ ! "$RCLONE_REMOTE" =~ ^[A-Za-z0-9_-]+$ ]] \
    || ! grep -Eq '^[A-Za-z0-9._/ -]+$' <<<"$RCLONE_REMOTE_DIR" \
    || [[ "$RCLONE_REMOTE_DIR" == /* ]] \
    || [[ "/$RCLONE_REMOTE_DIR/" == *"/../"* ]]; then
  log "FATAL" "unsafe rclone remote name or directory"
  exit 5
fi

if ! rclone_config_has_encrypted_header "$RCLONE_CONFIG"; then
  log "FATAL" "rclone config must be encrypted"
  exit 5
fi

# Restore is subject to the same least-privilege remote contract as upload.
# `config redacted` never prints the OAuth token or client secret in clear text.
REMOTE_CONFIG="$($RCLONE_BIN --config "$RCLONE_CONFIG" "${RCLONE_PASSWORD_ARGS[@]}" \
  config redacted "$RCLONE_REMOTE" 2>>"$LOG_FILE")" || {
  log "FATAL" "cannot read the redacted rclone remote configuration"
  exit 5
}
if ! grep -Eq '^type = drive$' <<<"$REMOTE_CONFIG" \
    || ! grep -Eq '^scope = drive\.file$' <<<"$REMOTE_CONFIG" \
    || ! grep -Eq '^client_id = .+$' <<<"$REMOTE_CONFIG"; then
  log "FATAL" "rclone remote must be Google Drive with drive.file and a dedicated client_id"
  exit 5
fi

RCLONE_COMMON_ARGS=(
  --config "$RCLONE_CONFIG"
  "${RCLONE_PASSWORD_ARGS[@]}"
  --retries 5
  --low-level-retries 10
  --retries-sleep 10s
  --contimeout 15s
  --timeout 2m
  --transfers 1
  --checkers 1
  --log-file "$LOG_FILE"
  --log-level INFO
)

REMOTE_ROOT="${RCLONE_REMOTE}:${RCLONE_REMOTE_DIR}"
LATEST_NAME="$($RCLONE_BIN lsf "$REMOTE_ROOT" --files-only \
  --include 'rtbackup-*.db.enc' --format p "${RCLONE_COMMON_ARGS[@]}" \
  | LC_ALL=C awk '/^rtbackup-[0-9]{8}-[0-9]{4}\.db\.enc$/' \
  | LC_ALL=C sort | tail -n 1)"
if [[ ! "$LATEST_NAME" =~ ^rtbackup-[0-9]{8}-[0-9]{4}\.db\.enc$ ]]; then
  log "FATAL" "no valid encrypted offsite backup was found"
  exit 5
fi

TMP_DIR="$(mktemp -d "$BACKUP_ROOT/.offsite-restore.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
ENC_FILE="$TMP_DIR/$LATEST_NAME"
TEST_DB="$TMP_DIR/restore-test.db"

"$RCLONE_BIN" copyto "$REMOTE_ROOT/$LATEST_NAME" "$ENC_FILE" \
  "${RCLONE_COMMON_ARGS[@]}"
if [ "$(head -c 8 "$ENC_FILE")" != "Salted__" ]; then
  log "FATAL" "downloaded object is not an encrypted OpenSSL backup"
  exit 6
fi

openssl enc -d -aes-256-cbc -pbkdf2 -iter "$PBKDF2_ITERATIONS" \
  "${OPENSSL_PASSWORD_ARGS[@]}" -in "$ENC_FILE" -out "$TEST_DB"
INTEGRITY="$(sqlite3 "$TEST_DB" "PRAGMA integrity_check;" 2>/dev/null || true)"
if [ "$INTEGRITY" != "ok" ]; then
  log "FATAL" "downloaded backup failed decrypt/integrity verification"
  exit 7
fi

log "INFO" "offsite restore drill passed for $LATEST_NAME"
