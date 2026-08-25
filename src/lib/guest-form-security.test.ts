import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  guestFormExpiry,
  mintGuestFormToken,
  publicSubmissionState,
  sameOriginRequest,
} from "@/lib/guest-form-security";

describe("guest-form public-link security", () => {
  it("mints an opaque token and expires it after checkout", () => {
    const token = mintGuestFormToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toMatch(/^\d+$/);
    expect(guestFormExpiry(new Date("2027-05-28T00:00:00.000Z")).toISOString())
      .toBe("2027-05-29T23:59:59.999Z");
  });

  it("fails closed for revoked, expired and submitted links", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-05-20T12:00:00.000Z"));
    const base = { revokedAt: null, expiresAt: null, submittedAt: null, status: "INVITED" };
    expect(publicSubmissionState(base)).toBe("active");
    expect(publicSubmissionState({ ...base, revokedAt: new Date() })).toBe("revoked");
    expect(publicSubmissionState({ ...base, expiresAt: new Date("2027-05-19") })).toBe("expired");
    expect(publicSubmissionState({ ...base, submittedAt: new Date() })).toBe("submitted");
    vi.useRealTimers();
  });

  it("rejects cross-origin writes", () => {
    expect(sameOriginRequest(new Request("https://renttools.test/api/g/token/draft", {
      headers: { origin: "https://renttools.test" },
    }))).toBe(true);
    expect(sameOriginRequest(new Request("https://renttools.test/api/g/token/draft", {
      headers: { origin: "https://attacker.test" },
    }))).toBe(false);
  });
});
