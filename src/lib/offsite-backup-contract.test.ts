import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const uploader = read("scripts/upload-backup-rclone.sh");
const restore = read("scripts/test-offsite-restore.sh");
const localBackup = read("scripts/backup-db.sh");

const hasEncryptedRcloneHeader = (content: string): boolean => {
  for (const line of content.split(/\r?\n/).slice(0, 10)) {
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    return line === "RCLONE_ENCRYPT_V0:";
  }
  return false;
};

describe("Google Drive offsite backup contract", () => {
  it("encrypts before an append-only, immutable upload", () => {
    expect(uploader).toContain("openssl enc -aes-256-cbc -salt -pbkdf2");
    expect(uploader).toContain("flock -n");
    expect(uploader).toContain('ENC_NAME="rtbackup-${STAMP}.db.enc"');
    expect(uploader).toContain('"$RCLONE_BIN" copyto');
    expect(uploader).toContain("--immutable");
    expect(uploader).toContain("--retries 5");
    expect(uploader).toContain("--low-level-retries 10");
    expect(uploader).toContain("--contimeout 15s");
    expect(uploader).toContain("--timeout 2m");
    expect(uploader).toContain("scope = drive\\.file");
  });

  it("contains no remote-destructive rclone command", () => {
    expect(uploader).not.toMatch(
      /\"\$RCLONE_BIN\"\s+(?:sync|move|delete|deletefile|purge|rmdir|moveto)\b/,
    );
    expect(restore).not.toMatch(
      /\"\$RCLONE_BIN\"\s+(?:sync|move|delete|deletefile|purge|rmdir|moveto)\b/,
    );
  });

  it("supports the deployed rclone v1.60 encrypted-config contract", () => {
    for (const script of [uploader, restore]) {
      expect(script).toContain("RCLONE_ENCRYPT_V0:");
      expect(script).toContain("config redacted");
      expect(script).toContain("--password-command");
      expect(script).not.toMatch(/config encryption check\s+>\/dev/);
      expect(script).toContain("scope = drive\\.file");
    }
    expect(uploader).toContain("^[A-Za-z0-9._/ -]+$");
  });

  it("accepts the official encrypted header and rejects plaintext camouflage", () => {
    expect(
      hasEncryptedRcloneHeader(
        "# Encrypted rclone configuration File\n\nRCLONE_ENCRYPT_V0:\nencoded-payload",
      ),
    ).toBe(true);
    expect(
      hasEncryptedRcloneHeader(
        "# generated config\n[zelic-drive]\ntype = drive\nRCLONE_ENCRYPT_V0:",
      ),
    ).toBe(false);
    expect(
      hasEncryptedRcloneHeader(
        `${"# comment\n".repeat(10)}RCLONE_ENCRYPT_V0:\nencoded-payload`,
      ),
    ).toBe(false);
  });

  it("queues only ciphertext and removes it only after checksum verification", () => {
    const verifyAt = uploader.indexOf('if [ -z "$remote_md5" ]');
    const removeAt = uploader.indexOf('rm -f "$pending"');
    expect(verifyAt).toBeGreaterThan(0);
    expect(removeAt).toBeGreaterThan(verifyAt);
    expect(uploader).toContain("ciphertext remains queued");
  });

  it("runs only after the local backup has passed integrity and rotation", () => {
    const integrityAt = localBackup.indexOf("PRAGMA integrity_check;");
    const rotationAt = localBackup.indexOf('prune_tier "$DEST/monthly" 3');
    const uploadAt = localBackup.indexOf('"$OFFSITE_UPLOADER" "$DAILY"');
    expect(integrityAt).toBeGreaterThan(0);
    expect(rotationAt).toBeGreaterThan(integrityAt);
    expect(uploadAt).toBeGreaterThan(rotationAt);
  });

  it("restores into a temporary database without touching prod.db", () => {
    expect(restore).toContain("mktemp -d");
    expect(restore).toContain("openssl enc -d -aes-256-cbc -pbkdf2");
    expect(restore).toContain("PRAGMA integrity_check;");
    expect(restore).toContain(
      "/^rtbackup-[0-9]{8}-[0-9]{4}\\.db\\.enc$/",
    );
    expect(restore).not.toContain("systemctl stop");
    expect(restore).not.toMatch(/(?:cp|mv)\s+.*prod\.db/);
  });
});
