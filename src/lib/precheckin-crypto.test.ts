import { afterEach, describe, expect, it } from "vitest";
import {
  decryptGuestData,
  encryptGuestData,
  guestDataEncryptionReady,
  hashShareToken,
  maskDocumentNumber,
} from "@/lib/precheckin-crypto";

const previousKey = process.env.GUEST_DATA_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.GUEST_DATA_ENCRYPTION_KEY;
  else process.env.GUEST_DATA_ENCRYPTION_KEY = previousKey;
});

describe("precheckin encryption", () => {
  it("fails closed without a key", () => {
    delete process.env.GUEST_DATA_ENCRYPTION_KEY;
    expect(guestDataEncryptionReady()).toBe(false);
    expect(() => encryptGuestData({ passport: "ABC123" })).toThrow(/not configured/);
  });

  it("round-trips authenticated encrypted JSON", () => {
    process.env.GUEST_DATA_ENCRYPTION_KEY = "11".repeat(32);
    const encrypted = encryptGuestData({ passport: "ABC123" });
    expect(encrypted).not.toContain("ABC123");
    expect(decryptGuestData(encrypted)).toEqual({ passport: "ABC123" });
  });

  it("hashes share tokens and masks documents", () => {
    expect(hashShareToken("secret")).toHaveLength(64);
    expect(maskDocumentNumber("ABCD123456")).toBe("••••••3456");
    expect(maskDocumentNumber("1234")).toBe("••••");
  });
});
