import type { AccessLevel } from "@/lib/ownership";

/**
 * Family access is for relatives who help with the flat: they see who is
 * coming and can add a stay. They are not part of the business side, so
 * the takings and the guest's phone number do not belong in an answer
 * they can request — hiding those in one screen while the API hands them
 * out is not a boundary, it is decoration.
 */

export interface VisibilityRow {
  propertyId?: number | null;
  grossAmountCents?: number | null;
  currency?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

export function redactForFamily<T extends VisibilityRow>(row: T): T {
  return { ...row, grossAmountCents: null, currency: null, phone: null };
}

export function redactReservationsForAccess<T extends VisibilityRow>(
  rows: T[],
  accessByProperty: ReadonlyMap<number, AccessLevel>,
): T[] {
  return rows.map((row) => {
    const propertyId = typeof row.propertyId === "number" ? row.propertyId : null;
    const access = propertyId === null ? undefined : accessByProperty.get(propertyId);
    // Fail closed: an access level we could not resolve is not a reason
    // to hand out the takings.
    return access === "owner" || access === "manager" ? row : redactForFamily(row);
  });
}
