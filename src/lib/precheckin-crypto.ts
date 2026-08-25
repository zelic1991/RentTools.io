import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function keyFromEnvironment(): Buffer {
  const raw = process.env.GUEST_DATA_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("GUEST_DATA_ENCRYPTION_KEY is not configured");
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (key.length !== 32) throw new Error("GUEST_DATA_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

export function guestDataEncryptionReady(): boolean {
  try {
    keyFromEnvironment();
    return true;
  } catch {
    return false;
  }
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function encryptGuestData(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromEnvironment(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptGuestData<T>(encrypted: string): T {
  const [version, ivPart, tagPart, ciphertextPart] = encrypted.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Unsupported encrypted guest-data payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", keyFromEnvironment(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export function maskDocumentNumber(value: string): string {
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}
