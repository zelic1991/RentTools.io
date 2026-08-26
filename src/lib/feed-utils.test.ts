import { describe, it, expect } from "vitest";
import { buildProtectedFeedUrl, parseFeedFilename } from "./feed-utils";

describe("parseFeedFilename", () => {
  // The whole point of this parser is that it accepts ANY platform slug,
  // not just airbnb/booking. Hosts on Vrbo, Expedia, Hostaway, custom OTAs
  // need their own outbound feed URL.
  it("extracts the airbnb slug", () => {
    expect(parseFeedFilename("for-airbnb.ics")).toBe("airbnb");
  });

  it("extracts the booking slug", () => {
    expect(parseFeedFilename("for-booking.ics")).toBe("booking");
  });

  it("extracts a custom slug (vrbo)", () => {
    expect(parseFeedFilename("for-vrbo.ics")).toBe("vrbo");
  });

  it("extracts longer custom slugs (hostaway, expedia)", () => {
    expect(parseFeedFilename("for-hostaway.ics")).toBe("hostaway");
    expect(parseFeedFilename("for-expedia.ics")).toBe("expedia");
  });

  it("accepts slugs containing digits and underscores", () => {
    expect(parseFeedFilename("for-houfy_2.ics")).toBe("houfy_2");
    expect(parseFeedFilename("for-platform99.ics")).toBe("platform99");
  });

  it("accepts multi-word channel slugs containing hyphens", () => {
    expect(parseFeedFilename("for-ubytovani-v-chorvatsku.ics"))
      .toBe("ubytovani-v-chorvatsku");
  });

  it("matches case-insensitively", () => {
    expect(parseFeedFilename("FOR-Vrbo.ICS")).toBe("Vrbo");
  });

  it("falls back to airbnb when filename is malformed", () => {
    expect(parseFeedFilename("calendar.ics")).toBe("airbnb");
    expect(parseFeedFilename("airbnb.ics")).toBe("airbnb");
    expect(parseFeedFilename("")).toBe("airbnb");
  });

  it("rejects slugs with disallowed characters", () => {
    // Path traversal / unusual chars should NOT pass through. The route
    // would fall back to "airbnb" rather than treat "../etc" as a slug.
    expect(parseFeedFilename("for-../etc.ics")).toBe("airbnb");
    expect(parseFeedFilename("for-foo bar.ics")).toBe("airbnb");
  });
});

describe("buildProtectedFeedUrl", () => {
  it("uses the durable slug and owner-authorized bearer token", () => {
    expect(buildProtectedFeedUrl(
      "https://renttools.test",
      "vir-apartment-0123456789ab",
      "owner-secret_token",
      "booking",
    )).toBe(
      "https://renttools.test/api/calendar/feed/vir-apartment-0123456789ab/for-booking.ics?token=owner-secret_token",
    );
  });

  it.each([
    [null, "token"],
    ["slug", null],
    ["", "token"],
    ["slug", ""],
  ])("fails closed instead of producing a public or numeric fallback", (feedSlug, feedToken) => {
    expect(buildProtectedFeedUrl(
      "https://renttools.test",
      feedSlug,
      feedToken,
      "airbnb",
    )).toBeNull();
  });
});
