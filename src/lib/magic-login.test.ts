import { describe, expect, it } from "vitest";
import { createMagicToken, hashMagicToken, MAGIC_LINK_TTL_MS } from "./magic-login";

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
});
