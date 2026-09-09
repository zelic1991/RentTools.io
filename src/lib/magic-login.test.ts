import { describe, expect, it } from "vitest";
import { createMagicToken, FAMILY_LINK_TTL_MS, hashMagicToken, MAGIC_LINK_TTL_MS, magicLinkUrl, ttlForKind } from "./magic-login";

describe("magic login tokens", () => {
  it("uses a 32-byte URL-safe secret and stores only its sha256 hash", () => {
    const created = createMagicToken(new Date("2026-01-01T00:00:00.000Z"));
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.tokenHash).toBe(hashMagicToken(created.token));
    expect(created.tokenHash).not.toContain(created.token);
  });

  it("expires exactly 30 minutes after creation", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(createMagicToken(now).expiresAt.getTime() - now.getTime()).toBe(MAGIC_LINK_TTL_MS);
  });

  it("gives a family link a year, not half an hour", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(ttlForKind("family")).toBe(FAMILY_LINK_TTL_MS);
    expect(ttlForKind("once")).toBe(MAGIC_LINK_TTL_MS);
    expect(createMagicToken(now, ttlForKind("family")).expiresAt.getTime() - now.getTime()).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it("builds the URL with an optional language for the holder", () => {
    expect(magicLinkUrl("https://app.example/", "t0k/en")).toBe("https://app.example/login/magic?token=t0k%2Fen");
    expect(magicLinkUrl("https://app.example", "t0k", "hr")).toBe("https://app.example/login/magic?token=t0k&locale=hr");
    expect(magicLinkUrl("https://app.example", "t0k", null)).not.toContain("locale");
  });
});
