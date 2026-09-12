import { describe, expect, it } from "vitest";
import type { AccessLevel } from "@/lib/ownership";
import {
  redactForFamily,
  redactReservationsForAccess,
} from "@/lib/reservation-visibility";

const row = (propertyId: number) => ({
  id: propertyId * 10,
  propertyId,
  name: "Krajci",
  grossAmountCents: 16280,
  currency: "EUR",
  phone: "+385 91 574 1358",
});

describe("reservation visibility", () => {
  it("strips takings and the phone number, keeps the stay itself", () => {
    const result = redactForFamily(row(1));
    expect(result.grossAmountCents).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.name).toBe("Krajci");
    expect(result.id).toBe(10);
  });

  it("redacts only the properties held at family level", () => {
    const access = new Map<number, AccessLevel>([
      [1, "family"],
      [2, "manager"],
      [3, "owner"],
    ]);
    const [family, manager, owner] = redactReservationsForAccess(
      [row(1), row(2), row(3)],
      access,
    );
    expect(family.grossAmountCents).toBeNull();
    expect(manager.grossAmountCents).toBe(16280);
    expect(owner.phone).toBe("+385 91 574 1358");
  });

  it("redacts a row whose property is not in the map at all", () => {
    // Unknown access is not a reason to hand out the amount.
    const [redacted] = redactReservationsForAccess([row(9)], new Map());
    expect(redacted.grossAmountCents).toBeNull();
    expect(redacted.phone).toBeNull();
  });
});
