import { describe, expect, it } from "vitest";
import {
  assertDirectReservationExternalKeyBinding,
  assertReservationExternalKeyBinding,
  assertReservationExternalKeyMutation,
  buildDirectReservationExternalKey,
  canonicalizeReservationPlatform,
  normalizeReservationExternalKey,
} from "./reservation-external-key";

const input = {
  propertyId: 1,
  checkIn: "2027-05-16",
  checkOut: "2027-05-28",
  ownerSource: {
    kind: "owner-chat" as const,
    recordedOn: "2026-08-25",
    sequence: 1,
  },
};

describe("direct reservation external key", () => {
  it("is deterministic and binds property, checkout-exclusive range and canonical Owner source", () => {
    const first = buildDirectReservationExternalKey(input);
    const second = buildDirectReservationExternalKey(structuredClone(input));
    expect(second).toBe(first);
    expect(first).toBe(
      "DIRECT:v1:p1:2027-05-16:2027-05-28:owner-chat:2026-08-25:001",
    );
  });

  it("does not accept or encode guest PII fields", () => {
    const unsafe = {
      ...input,
      guestName: "Example Guest",
      email: "guest@example.test",
      phone: "+385000000000",
    };
    expect(() => buildDirectReservationExternalKey(unsafe)).toThrow(/forbidden fields/);
    const key = buildDirectReservationExternalKey(input);
    expect(key).not.toMatch(/Example|guest@|\+385/);
    expect(() =>
      assertDirectReservationExternalKeyBinding(
        "DIRECT:v1:p1:2027-05-16:2027-05-28:owner-chat:guest@example.test:001",
        input,
      ),
    ).toThrow(/PII-free v1 contract/);
  });

  it("rejects a key rebound to another property or stay", () => {
    const key = buildDirectReservationExternalKey(input);
    expect(() =>
      assertDirectReservationExternalKeyBinding(key, { ...input, propertyId: 2 }),
    ).toThrow(/does not match/);
  });

  it("rejects ambiguous dates, invalid ranges and unstable source references", () => {
    expect(() => buildDirectReservationExternalKey({ ...input, checkIn: "16.05.2027" })).toThrow(
      /YYYY-MM-DD/,
    );
    expect(() => buildDirectReservationExternalKey({ ...input, checkOut: input.checkIn })).toThrow(
      /checkout-exclusive/,
    );
    expect(() =>
      buildDirectReservationExternalKey({
        ...input,
        ownerSource: { ...input.ownerSource, sequence: 0 },
      }),
    ).toThrow(/1 to 999/);
  });
});

describe("reservation platform and external-key contract", () => {
  it.each([
    [" Airbnb ", "airbnb"],
    ["AIR BNB", "airbnb"],
    ["Booking.com", "booking"],
    ["BOOKINGCOM", "booking"],
    ["Direct Sales", "direct"],
    ["Custom Partner", "custom-partner"],
  ])("canonicalizes %s to %s", (inputPlatform, expected) => {
    expect(canonicalizeReservationPlatform(inputPlatform)).toBe(expected);
  });

  it("trims bounded opaque keys without inventing provider date semantics", () => {
    expect(normalizeReservationExternalKey("  BOOKING:stable-42  ")).toBe(
      "BOOKING:stable-42",
    );
    expect(() =>
      assertReservationExternalKeyBinding({
        propertyId: 1,
        platform: "Booking.com",
        checkIn: "2027-06-01",
        checkOut: "2027-06-02",
        externalKey: "BOOKING:stable-42",
      }),
    ).not.toThrow();
  });

  it("binds a DIRECT:v1 key to direct + exact checkout-exclusive dates", () => {
    const externalKey = buildDirectReservationExternalKey(input);
    expect(() =>
      assertReservationExternalKeyBinding({
        propertyId: input.propertyId,
        platform: "booking",
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        externalKey,
      }),
    ).toThrow(/direct platform/);
    expect(() =>
      assertReservationExternalKeyMutation({
        externalKey,
        propertyId: input.propertyId,
        currentPlatform: "direct",
        nextPlatform: "direct",
        nextCheckIn: input.checkIn,
        nextCheckOut: "2027-05-29",
      }),
    ).toThrow(/does not match/);
  });

  it("allows opaque-key date corrections but never a platform namespace change", () => {
    expect(() =>
      assertReservationExternalKeyMutation({
        externalKey: "BOOKING:stable-42",
        propertyId: 1,
        currentPlatform: "Booking.com",
        nextPlatform: "booking",
        nextCheckIn: "2027-06-02",
        nextCheckOut: "2027-06-05",
      }),
    ).not.toThrow();
    expect(() =>
      assertReservationExternalKeyMutation({
        externalKey: "BOOKING:stable-42",
        propertyId: 1,
        currentPlatform: "booking",
        nextPlatform: "airbnb",
        nextCheckIn: "2027-06-02",
        nextCheckOut: "2027-06-05",
      }),
    ).toThrow(/platform is bound/);
  });
});
