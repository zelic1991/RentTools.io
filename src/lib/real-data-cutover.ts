import { assertDirectReservationExternalKeyBinding } from "./reservation-external-key";

export const REAL_DATA_CUTOVER_TIMEZONE = "Europe/Zagreb" as const;

export type ReservationSource = "airbnb" | "booking" | "direct";
export type AuthorityStatus = "confirmed" | "cancelled" | "blocked" | "owner-stay";
export type ProposedAction = "KEEP" | "CREATE" | "UPDATE" | "MANUAL_REVIEW";

export interface AuthorityReservation {
  source: ReservationSource;
  externalKey: string;
  propertyId: number;
  checkIn: string;
  checkOut: string;
  status: AuthorityStatus;
  guestCount?: number | null;
  evidenceSource: string;
}

export interface CurrentReservation {
  id: number;
  propertyId: number;
  platform: ReservationSource;
  checkIn: string;
  checkOut: string;
  bookedGuestCount?: number | null;
  /**
   * Durable reservation/import identity. This is deliberately independent of
   * Reservation.linkedEventUid, which remains calendar/feed linkage only.
   */
  externalKey?: string | null;
}

export interface CutoverPlannerOptions {
  durableDirectExternalKeyStorage: boolean;
}

export interface CutoverPlanRow extends AuthorityReservation {
  proposedAction: ProposedAction;
  currentReservationId: number | null;
  conflict: boolean;
  reason: string;
}

export interface CutoverPlan {
  timezone: typeof REAL_DATA_CUTOVER_TIMEZONE;
  rows: CutoverPlanRow[];
  summary: {
    realConfirmedUnique: number;
    wouldCreate: number;
    wouldUpdate: number;
    wouldKeep: number;
    wouldConflict: number;
    manualReviewRequired: number;
  };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SOURCE_PREFIX: Record<ReservationSource, string> = {
  airbnb: "AIRBNB:",
  booking: "BOOKING:",
  direct: "DIRECT:",
};
const FORBIDDEN_PII_KEYS = new Set([
  "name",
  "guestname",
  "email",
  "phone",
  "passport",
  "passportnumber",
  "documentnumber",
]);

function calendarDay(value: string, field: string): number {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error(`${field} must be an unambiguous YYYY-MM-DD calendar day`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(timestamp).toISOString().slice(0, 10);
  if (roundTrip !== value) throw new Error(`${field} is not a real calendar day`);
  return Math.floor(timestamp / 86_400_000);
}

function rangesOverlap(a: AuthorityReservation, b: AuthorityReservation): boolean {
  const aStart = calendarDay(a.checkIn, "checkIn");
  const aEnd = calendarDay(a.checkOut, "checkOut");
  const bStart = calendarDay(b.checkIn, "checkIn");
  const bEnd = calendarDay(b.checkOut, "checkOut");
  return aStart < bEnd && aEnd > bStart;
}

function authorityOverlapsCurrent(a: AuthorityReservation, b: CurrentReservation): boolean {
  const aStart = calendarDay(a.checkIn, "checkIn");
  const aEnd = calendarDay(a.checkOut, "checkOut");
  const bStart = calendarDay(b.checkIn, "current.checkIn");
  const bEnd = calendarDay(b.checkOut, "current.checkOut");
  return aStart < bEnd && aEnd > bStart;
}

function validateAuthority(record: AuthorityReservation): void {
  if (!Number.isInteger(record.propertyId) || record.propertyId <= 0) {
    throw new Error("propertyId must be a positive integer");
  }
  if (!record.externalKey.startsWith(SOURCE_PREFIX[record.source])) {
    throw new Error(`externalKey for ${record.source} must start with ${SOURCE_PREFIX[record.source]}`);
  }
  if (!record.evidenceSource.trim()) throw new Error("evidenceSource is required");
  if (record.guestCount != null && (!Number.isInteger(record.guestCount) || record.guestCount <= 0)) {
    throw new Error("guestCount must be a positive integer when present");
  }
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_PII_KEYS.has(key.toLowerCase())) {
      throw new Error(`Guest PII field is forbidden in the cutover manifest: ${key}`);
    }
  }
  const start = calendarDay(record.checkIn, "checkIn");
  const end = calendarDay(record.checkOut, "checkOut");
  if (end <= start) throw new Error("checkOut must be after checkIn (checkout-exclusive)");
  if (record.source === "direct") {
    assertDirectReservationExternalKeyBinding(record.externalKey, record);
  }
}

function currentMatchesAuthority(current: CurrentReservation, authority: AuthorityReservation): boolean {
  return (
    current.propertyId === authority.propertyId &&
    current.platform === authority.source &&
    current.checkIn === authority.checkIn &&
    current.checkOut === authority.checkOut &&
    (authority.guestCount == null || current.bookedGuestCount === authority.guestCount)
  );
}

function scopedExternalIdentity(record: Pick<AuthorityReservation, "propertyId" | "source" | "externalKey">): string {
  return `${record.propertyId}\u0000${record.source}\u0000${record.externalKey}`;
}

export function buildRealDataCutoverPlan(
  authorities: AuthorityReservation[],
  current: CurrentReservation[],
  options: CutoverPlannerOptions,
): CutoverPlan {
  authorities.forEach(validateAuthority);
  current.forEach((row) => {
    calendarDay(row.checkIn, "current.checkIn");
    const end = calendarDay(row.checkOut, "current.checkOut");
    const start = calendarDay(row.checkIn, "current.checkIn");
    if (end <= start) throw new Error(`Current reservation ${row.id} has an invalid range`);
  });

  const duplicateAuthorityKeys = new Set<string>();
  const keyCounts = new Map<string, number>();
  for (const record of authorities) {
    const identity = scopedExternalIdentity(record);
    keyCounts.set(identity, (keyCounts.get(identity) ?? 0) + 1);
  }
  for (const [key, count] of keyCounts) if (count > 1) duplicateAuthorityKeys.add(key);

  const overlappingAuthorityKeys = new Set<string>();
  const confirmed = authorities.filter((row) => row.status === "confirmed");
  for (let i = 0; i < confirmed.length; i++) {
    for (let j = i + 1; j < confirmed.length; j++) {
      const a = confirmed[i];
      const b = confirmed[j];
      if (a.externalKey !== b.externalKey && rangesOverlap(a, b)) {
        overlappingAuthorityKeys.add(a.externalKey);
        overlappingAuthorityKeys.add(b.externalKey);
      }
    }
  }

  const rows: CutoverPlanRow[] = authorities.map((authority) => {
    const base = {
      ...authority,
      currentReservationId: null,
      conflict: false,
    };

    if (duplicateAuthorityKeys.has(scopedExternalIdentity(authority))) {
      return {
        ...base,
        proposedAction: "MANUAL_REVIEW" as const,
        conflict: true,
        reason: "Duplicate external key in authority manifest",
      };
    }
    if (authority.status !== "confirmed") {
      return {
        ...base,
        proposedAction: "MANUAL_REVIEW" as const,
        reason: `${authority.status} is availability evidence, not an importable confirmed reservation`,
      };
    }
    if (overlappingAuthorityKeys.has(authority.externalKey)) {
      return {
        ...base,
        proposedAction: "MANUAL_REVIEW" as const,
        conflict: true,
        reason: "Overlaps another confirmed authority reservation",
      };
    }
    if (authority.source === "direct" && !options.durableDirectExternalKeyStorage) {
      return {
        ...base,
        proposedAction: "MANUAL_REVIEW" as const,
        reason: "Current schema has no durable Direct external-key field; applying would not be safely idempotent",
      };
    }

    const byExternalKey = current.filter(
      (row) =>
        row.propertyId === authority.propertyId &&
        row.platform === authority.source &&
        row.externalKey === authority.externalKey,
    );
    if (byExternalKey.length > 1) {
      return {
        ...base,
        proposedAction: "MANUAL_REVIEW" as const,
        conflict: true,
        reason: "Multiple current reservations share the same external key",
      };
    }
    if (byExternalKey.length === 1) {
      const matched = byExternalKey[0];
      return {
        ...base,
        currentReservationId: matched.id,
        proposedAction: currentMatchesAuthority(matched, authority) ? "KEEP" : "UPDATE",
        reason: currentMatchesAuthority(matched, authority)
          ? "Stable external key and reservation fields match"
          : "Stable external key matches but one or more reservation fields differ",
      };
    }

    const exactDateCandidates = current.filter(
      (row) =>
        row.propertyId === authority.propertyId &&
        row.platform === authority.source &&
        row.checkIn === authority.checkIn &&
        row.checkOut === authority.checkOut,
    );
    if (exactDateCandidates.length > 0) {
      return {
        ...base,
        proposedAction: "MANUAL_REVIEW" as const,
        conflict: true,
        reason: "Date/platform match exists without a durable external key; identity is unproven",
      };
    }

    const overlappingCurrent = current.filter(
      (row) => row.propertyId === authority.propertyId && authorityOverlapsCurrent(authority, row),
    );
    if (overlappingCurrent.length > 0) {
      return {
        ...base,
        proposedAction: "MANUAL_REVIEW" as const,
        conflict: true,
        reason: `Overlaps current reservation(s): ${overlappingCurrent.map((row) => row.id).join(",")}`,
      };
    }

    return {
      ...base,
      proposedAction: "CREATE" as const,
      reason: "Confirmed authority reservation has a stable external key and no current match",
    };
  });

  const uniqueConfirmedKeys = new Set(
    authorities.filter((row) => row.status === "confirmed").map(scopedExternalIdentity),
  );
  return {
    timezone: REAL_DATA_CUTOVER_TIMEZONE,
    rows,
    summary: {
      realConfirmedUnique: uniqueConfirmedKeys.size,
      wouldCreate: rows.filter((row) => row.proposedAction === "CREATE").length,
      wouldUpdate: rows.filter((row) => row.proposedAction === "UPDATE").length,
      wouldKeep: rows.filter((row) => row.proposedAction === "KEEP").length,
      wouldConflict: rows.filter((row) => row.conflict).length,
      manualReviewRequired: rows.filter((row) => row.proposedAction === "MANUAL_REVIEW").length,
    },
  };
}
