import { describe, expect, it } from "vitest";
import { decodeJwt } from "jose";
import {
  LONG_LIVED_REFRESH_AFTER_SECONDS,
  LONG_LIVED_SESSION_SECONDS,
  refreshLongLivedToken,
} from "./session-refresh";

const SECRET = new TextEncoder().encode("test-secret-for-session-refresh");
const NOW = 2_000_000_000;
const base = { userId: 3, username: "mama", role: "user", sessionVersion: 1, ll: true };

describe("refreshLongLivedToken", () => {
  it("re-issues a long-lived session older than a day for another year", async () => {
    const token = await refreshLongLivedToken(
      { ...base, iat: NOW - LONG_LIVED_REFRESH_AFTER_SECONDS - 1 },
      SECRET,
      NOW,
    );
    expect(token).not.toBeNull();
    const claims = decodeJwt(token!);
    expect(claims).toMatchObject({ userId: 3, username: "mama", role: "user", sessionVersion: 1, ll: true });
    expect(claims.iat).toBe(NOW);
    expect(claims.exp).toBe(NOW + LONG_LIVED_SESSION_SECONDS);
  });

  it("leaves a fresh long-lived session alone", async () => {
    expect(await refreshLongLivedToken({ ...base, iat: NOW - 60 }, SECRET, NOW)).toBeNull();
  });

  it("never extends a normal 7-day session", async () => {
    expect(
      await refreshLongLivedToken({ ...base, ll: undefined, iat: NOW - 3 * 86400 }, SECRET, NOW),
    ).toBeNull();
  });

  it("never extends an impersonation session", async () => {
    expect(
      await refreshLongLivedToken({ ...base, impersonatorId: 1, iat: NOW - 3 * 86400 }, SECRET, NOW),
    ).toBeNull();
  });

  it("refuses a payload with missing identity fields", async () => {
    expect(
      await refreshLongLivedToken({ ll: true, userId: 3, iat: NOW - 3 * 86400 }, SECRET, NOW),
    ).toBeNull();
  });
});
