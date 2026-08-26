# CalendarLink default-repair evidence

This directory contains the sanitized receipt for the pre-admission backup,
offsite download/restore and isolated migration rehearsal used by PR #17.

The receipt deliberately contains no database file, guest data, provider iCal
URL, OAuth material, backup passphrase or rclone configuration. Its hashes can
be checked by an independent reviewer with authorized access to the protected
backup object.

Canonical repository procedures used:

- `scripts/backup-db.sh` creates and integrity-checks the production snapshot.
- `scripts/upload-backup-rclone.sh` creates and uploads the authenticated V2
  object.
- `scripts/test-offsite-restore.sh` independently downloads, authenticates,
  restores and integrity-checks the latest V2 object.
- `scripts/offsite-backup-format.sh decrypt` was also run against a separate
  download to compare the source and restored plaintext SHA-256 values.

The migration rehearsal used a new plaintext copy outside the production DB
path. The production database was never the migration target. The temporary
plaintext copies were removed after the hashes, schema state and logical row
comparisons were recorded.
