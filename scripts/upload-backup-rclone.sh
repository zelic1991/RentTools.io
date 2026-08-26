#!/bin/bash
# Encrypt a verified local SQLite snapshot and copy the ciphertext to Google
# Drive. The remote is append-only: this script never syncs, moves, or deletes
# remote objects. Failed uploads remain in the local pending queue for the next
# run.

set -euo pipefail
umask 077

BACKUP_ROOT="${BACKUP_ROOT:-/home/app/backups}"
PENDING_DIR="${OFFSITE_PENDING_DIR:-$BACKUP_ROOT/offsite-pending}"
LOCK_FILE="${OFFSITE_UPLOAD_LOCK_FILE:-$BACKUP_ROOT/.offsite-upload.lock}"
LOG_FILE="${OFFSITE_UPLOAD_LOG_FILE:-/home/app/logs/rent-tool-offsite-backup.log}"
CONFIG_FILE="${OFFSITE_BACKUP_CONFIG_FILE:-/home/app/.renttools-offsite-backup.env}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

log() {
  local level="$1"
  shift
  printf '[%s] %s %s\n' "$(ts)" "$level" "$*" | tee -a "$LOG_FILE" >&2
}

require_private_file() {
  local path="$1"
  local label="$2"
  local mode
  if [ ! -r "$path" ]; then
    log "FATAL" "$label is not readable: $path"
    return 1
  fi
  mode="$(stat -c '%a' "$path")"
  if [[ ! "$mode" =~ ^[46]00$ ]]; then
    log "FATAL" "$label permissions must be 400 or 600: $path"
    return 1
  fi
}

rclone_config_has_encrypted_header() {
  # Official encrypted configs may start with comment/blank lines. Require the
  # version marker as the first meaningful line and keep it near the top so a
  # plaintext remote section cannot be hidden before it.
  awk '
    NR > 10 { exit 1 }
    /^[[:space:]]*$/ || /^[[:space:]]*#/ { next }
    $0 == "RCLONE_ENCRYPT_V0:" { found = 1; exit 0 }
    { exit 1 }
    END { if (!found) exit 1 }
  ' "$1"
}

mkdir -p "$PENDING_DIR" "$(dirname "$LOG_FILE")"
chmod 700 "$PENDING_DIR"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "WARN" "another offsite-backup upload is already running"
  exit 75
fi

# This trusted, owner-only file holds settings, never backup data. It lives
# outside the git checkout and must be chmod 600. Environment variables may be
# used instead (useful for one-off restore tests).
if [ -f "$CONFIG_FILE" ]; then
  config_mode="$(stat -c '%a' "$CONFIG_FILE")"
  if [[ ! "$config_mode" =~ ^[46]00$ ]]; then
    log "FATAL" "offsite config permissions must be 400 or 600: $CONFIG_FILE"
    exit 2
  fi
  set -a
  # shellcheck disable=SC1090 -- owner-managed path outside the repository
  . "$CONFIG_FILE"
  set +a
fi

if [ "${OFFSITE_BACKUP_ENABLED:-0}" != "1" ]; then
  log "INFO" "Google Drive offsite backup is disabled"
  exit 0
fi

RCLONE_CONFIG="${RCLONE_CONFIG:-/home/app/.config/rclone/rclone.conf}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive_offsite}"
RCLONE_REMOTE_DIR="${RCLONE_REMOTE_DIR:-RentTools-Backups}"
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-/home/app/.renttools-backup-pass}"
RCLONE_CONFIG_PASS_FILE="${RCLONE_CONFIG_PASS_FILE:-/home/app/.renttools-rclone-config-pass}"
PBKDF2_ITERATIONS="${PBKDF2_ITERATIONS:-200000}"

if ! command -v "$RCLONE_BIN" >/dev/null 2>&1; then
  log "FATAL" "rclone is not installed"
  exit 3
fi
if ! command -v sqlite3 >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  log "FATAL" "sqlite3 and openssl are required"
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

# rclone v1.60 (Ubuntu 24.04 package) has no `config encryption check`
# subcommand. Reject plaintext before asking rclone to decrypt the config.
if ! rclone_config_has_encrypted_header "$RCLONE_CONFIG"; then
  log "FATAL" "rclone config must be encrypted"
  exit 5
fi

# Enforce the least-privilege Google Drive scope at runtime. `config redacted`
# never prints the OAuth token or client secret in clear text.
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

SOURCE="${1:-$BACKUP_ROOT/latest}"
SOURCE_REAL="$(readlink -f "$SOURCE" 2>/dev/null || true)"
BACKUP_ROOT_REAL="$(readlink -f "$BACKUP_ROOT" 2>/dev/null || true)"
if [ -z "$SOURCE_REAL" ] || [ ! -f "$SOURCE_REAL" ]; then
  log "FATAL" "backup snapshot is missing"
  exit 6
fi
case "$SOURCE_REAL" in
  "$BACKUP_ROOT_REAL"/daily/prod-*.db|"$BACKUP_ROOT_REAL"/weekly/prod-*.db|"$BACKUP_ROOT_REAL"/monthly/prod-*.db) ;;
  *)
    log "FATAL" "refusing to upload a file outside the managed backup tiers"
    exit 6
    ;;
esac

if ! sqlite3 "$SOURCE_REAL" "PRAGMA integrity_check;" | grep -q '^ok$'; then
  log "FATAL" "source snapshot failed SQLite integrity_check"
  exit 7
fi

SOURCE_NAME="$(basename "$SOURCE_REAL")"
if [[ ! "$SOURCE_NAME" =~ ^prod-([0-9]{8}-[0-9]{4})\.db$ ]]; then
  log "FATAL" "snapshot filename does not match the managed timestamp format"
  exit 7
fi
STAMP="${BASH_REMATCH[1]}"
ENC_NAME="rtbackup-${STAMP}.db.enc"
ENC_FILE="$PENDING_DIR/$ENC_NAME"

if [ ! -f "$ENC_FILE" ]; then
  ENC_TMP="$PENDING_DIR/.${ENC_NAME}.tmp.$$"
  trap 'rm -f "${ENC_TMP:-}"' EXIT
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter "$PBKDF2_ITERATIONS" \
    "${OPENSSL_PASSWORD_ARGS[@]}" -in "$SOURCE_REAL" -out "$ENC_TMP"
  if [ "$(head -c 8 "$ENC_TMP")" != "Salted__" ]; then
    log "FATAL" "encrypted backup is missing the OpenSSL salt header"
    exit 8
  fi
  chmod 600 "$ENC_TMP"
  mv "$ENC_TMP" "$ENC_FILE"
  trap - EXIT
  log "INFO" "queued encrypted backup $ENC_NAME"
else
  log "INFO" "encrypted backup already queued; retrying $ENC_NAME"
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

failed=0
shopt -s nullglob
for pending in "$PENDING_DIR"/rtbackup-*.db.enc; do
  pending_name="$(basename "$pending")"
  remote_path="${RCLONE_REMOTE}:${RCLONE_REMOTE_DIR}/${pending_name}"

  # copyto + immutable is append-only: an existing object may be accepted only
  # when unchanged; a name collision with different ciphertext fails closed.
  if ! "$RCLONE_BIN" copyto "$pending" "$remote_path" \
      --immutable "${RCLONE_COMMON_ARGS[@]}"; then
    log "ERROR" "upload failed; ciphertext remains queued: $pending_name"
    failed=1
    continue
  fi

  local_md5="$(md5sum "$pending" | awk '{print $1}')"
  remote_md5="$($RCLONE_BIN md5sum "$remote_path" "${RCLONE_COMMON_ARGS[@]}" \
    2>>"$LOG_FILE" | awk 'NR == 1 {print $1}')" || remote_md5=""
  if [ -z "$remote_md5" ] || [ "$local_md5" != "$remote_md5" ]; then
    log "ERROR" "remote checksum verification failed; ciphertext remains queued: $pending_name"
    failed=1
    continue
  fi

  rm -f "$pending"
  log "INFO" "verified offsite backup $pending_name"
done

if [ "$failed" -ne 0 ]; then
  exit 9
fi

log "INFO" "offsite backup queue is fully uploaded"
