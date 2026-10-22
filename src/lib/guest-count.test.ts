import { describe, expect, it } from "vitest";
import { displayGuestCount } from "./guest-count";

describe("displayGuestCount", () => {
  it("prefers the confirmed traveler count", () => {
    expect(displayGuestCount({ bookedGuestCount: 5, _count: { guests: 2 } })).toBe(5);
  });

  it("falls back to stored passport guests", () => {
    expect(displayGuestCount({ bookedGuestCount: null, _count: { guests: 2 } })).toBe(2);
  });

  it("is zero when nothing is known", () => {
    expect(displayGuestCount({})).toBe(0);
  });
});
