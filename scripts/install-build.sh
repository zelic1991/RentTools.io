#!/bin/bash
# Install a CI-built artifact on the droplet.
#
# Triggered by .github/workflows/deploy.yml after the runner finishes
# `npm ci + next build` and ships the tarball here. This is the fast-path
# replacement for the old scripts/deploy.sh on-droplet build.
#
# Total runtime target: ~30s if package-lock.json unchanged, ~4 min if a
# fresh `npm ci` is needed (dependencies actually changed).
#
# Arg: $1 = path to build.tar.gz (default /tmp/build.tar.gz)
# Env: GIT_COMMIT_SHA = the SHA the artifact was built from (CI passes this)
#      MIN_FREE_MB    = free space required before npm ci may run (default 1024)
#
# Exit codes: 1 artifact missing · 10 dirty droplet checkout · 11 bad artifact
#             12 too little disk for npm ci · 13 npm ci left an incomplete tree
#             14 service would not stop, so the database is still in use
#             15 schema migration failed (service restarted, deploy fails)
#             20 restarted but health check never came up
#
# Steps:
#  1. git fetch + reset --hard to GIT_COMMIT_SHA so source files (prisma/,
#     scripts/, sentry configs, env-template) match the artifact
#  2. compare package-lock.json hashes; only npm ci if changed
#  3. atomically replace .next/ and src/generated/prisma/ with extracted artifact
#  4. stop rent-tool, then apply schema if its inputs changed, then seed blog
#     posts — all database work runs against an idle database
#  5. install systemd unit if it changed (then daemon-reload)
#  5b. sync nginx maintenance.html if it changed (then reload nginx)
#  6. systemctl restart rent-tool
#  7. smoke-test /api/health
#
# Any failure after the service was stopped starts it again before exiting,
# so a broken deploy never leaves the site down.

set -euo pipefail

ARTIFACT="${1:-/tmp/build.tar.gz}"
# REPO_DIR/SERVICE_NAME/HEALTH_URL stay overridable so the deploy contract
# test can run this script end to end against a scratch checkout. The
# deploy passes none of them and gets the droplet values below.
REPO="${REPO_DIR:-/home/app/rent-tool}"
SERVICE="${SERVICE_NAME:-rent-tool}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
TARGET_SHA="${GIT_COMMIT_SHA:-origin/master}"
SCHEMA_FINGERPRINT_SCRIPT="${SCHEMA_FINGERPRINT_SCRIPT:-/tmp/schema-input-fingerprint.mjs}"

ts() { date -Is; }
log() { echo "[$(ts)] install-build: $*"; }

cd "$REPO"

if [ ! -f "$ARTIFACT" ]; then
  log "ABORT — artifact not found: $ARTIFACT" >&2
  exit 1
fi

# 1. Sync source code so prisma/, scripts/, sentry configs match the SHA we built.
if [ ! -f "$SCHEMA_FINGERPRINT_SCRIPT" ]; then
  log "ABORT — schema fingerprint helper not found: $SCHEMA_FINGERPRINT_SCRIPT" >&2
  exit 1
fi
LOCK_BEFORE=$(sha256sum package-lock.json 2>/dev/null | awk '{print $1}' || echo "")
SCHEMA_INPUTS_BEFORE=$(node "$SCHEMA_FINGERPRINT_SCRIPT" "$REPO")
SYSTEMD_BEFORE=$(sha256sum deploy/systemd/rent-tool.service 2>/dev/null | awk '{print $1}' || echo "")
# nginx serves the maintenance page from /etc/nginx/html/ — outside the
# repo, so `git reset` never touches it. Track the repo copy's hash so a
# change to it gets pushed to nginx below instead of silently drifting.
MAINT_BEFORE=$(sha256sum deploy/nginx/maintenance.html 2>/dev/null | awk '{print $1}' || echo "")
# logrotate rule for /home/app/logs — the cron jobs append there forever and
# Ubuntu ships no rule that covers it. Same install-on-change treatment as
# the unit and the maintenance page, since its target is outside the repo.
LOGROTATE_BEFORE=$(sha256sum deploy/logrotate/rent-tool 2>/dev/null | awk '{print $1}' || echo "")

# Refuse to proceed if someone edited files directly on the droplet — prevents
# silent overwrite of unsaved local changes by `git reset --hard`.
if ! git diff --quiet || ! git diff --cached --quiet; then
  log "ABORT — droplet working copy has uncommitted changes" >&2
  git status --short >&2
  exit 10
fi

git fetch --quiet origin master
git reset --hard --quiet "$TARGET_SHA"
log "now at $(git rev-parse --short HEAD)"

# Hand the deployed SHA to the service itself. GIT_COMMIT_SHA reaches this
# script but never reached the systemd unit, so the app booted without it
# and /api/health always reported version "dev". The unit reads this via
# `EnvironmentFile=-`, and .gitignore's `.env.*` keeps the file untracked
# so the `git reset --hard` above never clobbers it.
printf 'GIT_COMMIT_SHA=%s\n' "$(git rev-parse HEAD)" > .env.release
log "recorded release $(git rev-parse --short HEAD) for the service env"

LOCK_AFTER=$(sha256sum package-lock.json | awk '{print $1}')
SCHEMA_INPUTS_AFTER=$(node "$SCHEMA_FINGERPRINT_SCRIPT" "$REPO")
SYSTEMD_AFTER=$(sha256sum deploy/systemd/rent-tool.service | awk '{print $1}')
MAINT_AFTER=$(sha256sum deploy/nginx/maintenance.html | awk '{print $1}')
LOGROTATE_AFTER=$(sha256sum deploy/logrotate/rent-tool 2>/dev/null | awk '{print $1}' || echo "")

# 2. Conditional npm ci. Run when dependencies changed OR the checkout has no
# usable runtime yet (fresh VM / incomplete prior install).
if [ "$LOCK_BEFORE" != "$LOCK_AFTER" ] || [ ! -x node_modules/.bin/next ]; then
  # npm ci REMOVES node_modules before repopulating it. Running out of
  # space partway leaves a tree that has package directories but no
  # .bin symlinks, so `next start` dies with "next: not found" (exit
  # 127) and Restart=always turns that into an unbounded crash loop —
  # a full outage, from a deploy that only meant to bump a dependency.
  # That is exactly how this box went down on 2026-08-07.
  #
  # So check headroom while the current install is still intact and
  # serving, and fail the DEPLOY rather than the site.
  MIN_FREE_MB="${MIN_FREE_MB:-1024}"
  FREE_MB=$(df -Pm "$REPO" | awk 'NR==2 {print $4}')
  if [ "$FREE_MB" -lt "$MIN_FREE_MB" ]; then
    log "ABORT — ${FREE_MB}MB free, need ${MIN_FREE_MB}MB for npm ci; leaving the running install untouched" >&2
    exit 12
  fi
  log "dependencies changed or runtime missing — running npm ci (${FREE_MB}MB free)"
  npm ci --no-audit --no-fund
else
  log "package-lock.json unchanged and Next.js runtime present — skipping npm ci"
fi

# The dangerous case is an install that exits 0 but is incomplete, so verify
# the entrypoint systemd actually execs before the artifact swap/restart.
if [ ! -x node_modules/.bin/next ]; then
  log "ABORT — npm ci finished but node_modules/.bin/next is missing; install incomplete" >&2
  exit 13
fi

# 3. Atomic swap of .next/ and src/generated/prisma/.
TMPDIR=$(mktemp -d -t rt-build-XXXXXX)
tar -xzf "$ARTIFACT" -C "$TMPDIR"

if [ ! -d "$TMPDIR/.next" ] || [ ! -d "$TMPDIR/src/generated/prisma" ]; then
  log "ABORT — artifact missing .next/ or src/generated/prisma/" >&2
  rm -rf "$TMPDIR"
  exit 11
fi

PID="$$"
[ -d .next ] && mv .next ".next.old.$PID"
[ -d src/generated/prisma ] && mv src/generated/prisma "src/generated/prisma.old.$PID"

mkdir -p src/generated
mv "$TMPDIR/.next" .next
mv "$TMPDIR/src/generated/prisma" src/generated/prisma

# Background cleanup — `rm -rf .next.old` is ~5s on this disk, no need to block.
rm -rf ".next.old.$PID" "src/generated/prisma.old.$PID" "$TMPDIR" "$ARTIFACT" &

# 4. Database work — schema migration, then the blog seed.
#
#    Both write to the production SQLite file, and SQLite's writer lock is
#    exclusive. On 2026-08-26 push-schema.ts died with
#    `SQLITE_BUSY: database is locked` partway through its ALTER TABLE
#    sequence because rent-tool was still serving requests against the same
#    file. `set -e` then aborted the deploy AFTER the artifact swap, leaving
#    the box running the old process on top of a freshly swapped .next.
#
#    So: stop the service, do the database work against an idle database,
#    and guarantee the service comes back however this block exits. The
#    artifact swap has to stay above this point — push-schema.ts imports the
#    generated Prisma client from src/generated/prisma, so the migration must
#    run against the client that matches the schema it is applying.
#
#    Nothing here rewrites or removes existing rows: push-schema.ts is
#    additive (ADD COLUMN / CREATE TABLE) and the blog seed upserts on
#    (slug, locale). Reservations and all other existing data are untouched.

SERVICE_STOPPED=0

restore_service_on_failure() {
  if [ "$SERVICE_STOPPED" = "1" ]; then
    log "deploy failed while $SERVICE was stopped — starting it again" >&2
    sudo systemctl start "$SERVICE" ||
      log "WARN — could not start $SERVICE; check journalctl -u $SERVICE -n 50" >&2
    SERVICE_STOPPED=0
  fi
}
trap restore_service_on_failure EXIT

log "stopping $SERVICE before database work"
sudo systemctl stop "$SERVICE"
SERVICE_STOPPED=1

# `systemctl stop` returns once the unit is inactive, but say it out loud: a
# process that is still up still holds the writer lock, and migrating anyway
# would just reproduce the SQLITE_BUSY this block exists to prevent.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  systemctl is-active --quiet "$SERVICE" || break
  sleep 1
done
if systemctl is-active --quiet "$SERVICE"; then
  log "ABORT — $SERVICE still active after stop; refusing to migrate a live database" >&2
  exit 14
fi
log "$SERVICE stopped — database is idle"

set -a
. .env.production
set +a

# 4a. Apply schema if schema.prisma, push-schema.ts, or any recursively
#     imported local migration dependency changed.
if [ "$SCHEMA_INPUTS_BEFORE" != "$SCHEMA_INPUTS_AFTER" ]; then
  log "schema migration inputs changed — pushing"
  if ! npx tsx prisma/push-schema.ts; then
    log "ABORT — schema migration failed; restarting $SERVICE and failing the deploy" >&2
    exit 15
  fi
  log "schema migration applied"
else
  log "schema migration inputs unchanged — skipping schema push"
fi

# 4b. Seed BlogPost rows from content/blog/*.md (RT-25.14). The seed
#     is idempotent — upserts on (slug, locale) — so it's safe to run
#     on every deploy. Without this step the public /blog and the
#     admin "Blog posts" sub-route both render empty even though the
#     7 source articles ship in the repo. Source-of-truth for the
#     post body is the markdown file, so this also picks up edits.
log "seeding blog posts from content/blog/"
npx tsx prisma/seed-blog-posts.ts || log "blog seed failed (non-fatal — deploy continues)"

# 5. If the systemd unit changed, reload its definition before restart.
if [ "$SYSTEMD_BEFORE" != "$SYSTEMD_AFTER" ]; then
  log "systemd unit changed — installing + reloading daemon"
  sudo install -m 644 deploy/systemd/rent-tool.service /etc/systemd/system/rent-tool.service
  sudo systemctl daemon-reload
fi

# 5b. If the maintenance page changed, push it to where nginx serves it
#     from and reload. Kept here (not the artifact swap) because the
#     target lives under /etc/nginx/, outside the repo tree.
if [ "$MAINT_BEFORE" != "$MAINT_AFTER" ]; then
  log "maintenance.html changed — installing + reloading nginx"
  sudo install -m 644 deploy/nginx/maintenance.html /etc/nginx/html/maintenance.html
  sudo nginx -t && sudo systemctl reload nginx
fi

# 5c. Same for the logrotate rule — target lives under /etc/logrotate.d/.
#     `logrotate -d` is a dry run, so a malformed rule fails here rather
#     than silently disabling rotation for these logs.
if [ "$LOGROTATE_BEFORE" != "$LOGROTATE_AFTER" ] && [ -f deploy/logrotate/rent-tool ]; then
  log "logrotate rule changed — installing"
  sudo install -m 644 -o root -g root deploy/logrotate/rent-tool /etc/logrotate.d/rent-tool
  if sudo logrotate -d /etc/logrotate.d/rent-tool >/dev/null 2>&1; then
    log "logrotate rule validated"
  else
    log "WARN — logrotate rejected /etc/logrotate.d/rent-tool; app cron logs will not rotate" >&2
  fi
fi

# 6. Restart. The service is stopped at this point (step 4); `restart` starts
#    it either way. Clearing the flag disarms the EXIT trap so the health
#    check below owns the outcome from here on.
log "starting $SERVICE"
sudo systemctl restart "$SERVICE"
SERVICE_STOPPED=0

# 7. Smoke test.
sleep 3
for attempt in 1 2 3 4 5; do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; then
    log "OK — $(git rev-parse --short HEAD) live"
    exit 0
  fi
  sleep 2
done

log "WARN — service restarted but $HEALTH_URL didn't respond cleanly. Check journalctl -u $SERVICE -n 50" >&2
exit 20
