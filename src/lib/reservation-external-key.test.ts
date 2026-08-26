import { describe, expect, it } from "vitest";
import {
  assertDirectReservationExternalKeyBinding,
  buildDirectReservationExternalKey,
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
