import { describe, expect, it } from "vitest";
import { describeGuestLink } from "@/lib/mobile-guest-link-core";

const NOW = "2026-09-12T06:00:00.000Z";

describe("mobile guest link state", () => {
  it("has nothing to show before the first link", () => {
    expect(describeGuestLink(null, NOW)).toEqual({ state: "none", canShare: false });
  });

  it("is shareable while the guest has not answered", () => {
    expect(
      describeGuestLink({ shareUrl: "/g/abc", expiresAt: "2026-09-20T00:00:00.000Z" }, NOW),
    ).toEqual({ state: "waiting", canShare: true });
  });

  it("stops offering the link once the guest has filled it in", () => {
    expect(
      describeGuestLink(
        { shareUrl: "/g/abc", submittedAt: "2026-09-11T18:00:00.000Z" },
        NOW,
      ),
    ).toEqual({ state: "submitted", canShare: false });
  });

  it("treats an expired link as expired even though the URL still exists", () => {
    // The link dies at checkout; sending it afterwards would hand the
    // guest a page that only says the link is no longer active.
    expect(
      describeGuestLink({ shareUrl: "/g/abc", expiresAt: "2026-09-11T10:00:00.000Z" }, NOW),
    ).toEqual({ state: "expired", canShare: false });
  });

  it("respects a revoked link before anything else", () => {
    expect(
      describeGuestLink(
        {
          shareUrl: "/g/abc",
          revokedAt: "2026-09-11T10:00:00.000Z",
          expiresAt: "2026-09-20T00:00:00.000Z",
        },
        NOW,
      ),
    ).toEqual({ state: "revoked", canShare: false });
  });

  it("never claims a link it cannot read back", () => {
    expect(
      describeGuestLink({ shareUrl: null, expiresAt: "2026-09-20T00:00:00.000Z" }, NOW),
    ).toEqual({ state: "unavailable", canShare: false });
  });
});
