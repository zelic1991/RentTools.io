import {
  summarizeRevenueBreakdown,
  summarizeStoredGrossAmounts,
  type RevenueBreakdown,
  type StoredGrossAmountSummary,
} from "@/lib/reservation-revenue";
import {
  canAccessMobileSection,
  type MobileAccessLevel,
} from "@/lib/mobile-operations-core";

/**
 * The phone view shipped without any reports: every figure lived in the
 * desktop dashboard, so a host who opens the installed mobile app saw
 * arrivals and cleaning but never a number. These helpers derive the same
 * conservative figures the desktop panel shows — stored amounts only, no
 * inferred nightly rate — so the mobile screen stays a second *view* of
 * the numbers rather than a second source of them.
 */

export interface MobileReportsReservation {
  checkIn: string;
  checkOut: string;
  platform: string;
  grossAmountCents: number | null;
  currency: string | null;
  linkedEventPlatform: string | null;
  linkedEventUid: string | null;
  linkedEventRole: string | null;
}

export interface MobileReportsEvent {
  platform: string;
  uid: string;
  startDate: string;
  endDate: string;
}

export interface MobileReportsData {
  /** Reservations stored in the app — imported events are not bookings. */
  bookings: number;
  totalNights: number;
  averageNights: number | null;
  /** Occupied nights from today to the end of the booking window. */
  upcomingNights: number;
  stored: StoredGrossAmountSummary;
  breakdown: RevenueBreakdown;
}

function nightsBetween(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T12:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  const nights = Math.round((end - start) / 86_400_000);
  return nights > 0 ? nights : 0;
}

function clip(from: string, to: string, windowStart: string, windowEnd: string): [string, string] | null {
  const start = from.slice(0, 10) > windowStart ? from.slice(0, 10) : windowStart;
  const end = to.slice(0, 10) < windowEnd ? to.slice(0, 10) : windowEnd;
  return nightsBetween(start, end) > 0 ? [start, end] : null;
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function linkedSourceKey(platform: string | null, uid: string | null): string | null {
  if (!platform || !uid) return null;
  return `${platform.toLowerCase()}|${uid}`;
}

/**
 * Nights, not stays: Airbnb and Booking both export the same occupied
 * night whenever one platform's booking has been mirrored to the other,
 * and a claimed event is also its reservation. Counting rows would inflate
 * both cases, so the ranges are merged into a union first.
 */
function unionNights(ranges: Array<[string, string]>): number {
  const sorted = [...ranges].sort((a, b) => a[0].localeCompare(b[0]));
  let nights = 0;
  let openFrom: string | null = null;
  let openTo: string | null = null;
  for (const [from, to] of sorted) {
    if (openFrom === null || openTo === null) {
      openFrom = from;
      openTo = to;
      continue;
    }
    if (from <= openTo) {
      if (to > openTo) openTo = to;
      continue;
    }
    nights += nightsBetween(openFrom, openTo);
    openFrom = from;
    openTo = to;
  }
  if (openFrom !== null && openTo !== null) nights += nightsBetween(openFrom, openTo);
  return nights;
}

export function summarizeMobileReports(input: {
  reservations: MobileReportsReservation[];
  events: MobileReportsEvent[];
  /** Days the host closed by hand — occupied for the portals, and the
   *  tile promises to count them. */
  blockedDates?: Iterable<string>;
  today: string;
  /** First day that is no longer bookable, i.e. the window's checkout
   *  bound. Passing the last bookable *night* here drops that night. */
  untilCheckout: string;
}): MobileReportsData {
  const { reservations, events, blockedDates, today, untilCheckout } = input;
  const until = untilCheckout;

  // A claim renames one imported event, so the event and the reservation
  // are the same stay. An extension is a separate direct stay that only
  // abuts its source — the union below keeps it.
  const claimed = new Set<string>();
  for (const reservation of reservations) {
    if (reservation.linkedEventRole !== "claim") continue;
    const key = linkedSourceKey(
      reservation.linkedEventPlatform ?? reservation.platform,
      reservation.linkedEventUid,
    );
    if (key) claimed.add(key);
  }

  const occupied: Array<[string, string]> = [];
  for (const reservation of reservations) {
    const range = clip(reservation.checkIn, reservation.checkOut, today, until);
    if (range) occupied.push(range);
  }
  for (const event of events) {
    const key = linkedSourceKey(event.platform, event.uid);
    if (key && claimed.has(key)) continue;
    const range = clip(event.startDate, event.endDate, today, until);
    if (range) occupied.push(range);
  }

  for (const blocked of blockedDates ?? []) {
    const day = String(blocked).slice(0, 10);
    const range = clip(day, addOneDay(day), today, until);
    if (range) occupied.push(range);
  }

  const totalNights = reservations.reduce(
    (sum, reservation) => sum + nightsBetween(reservation.checkIn, reservation.checkOut),
    0,
  );

  return {
    bookings: reservations.length,
    totalNights,
    averageNights:
      reservations.length > 0
        ? Math.round((10 * totalNights) / reservations.length) / 10
        : null,
    upcomingNights: unionNights(occupied),
    stored: summarizeStoredGrossAmounts(reservations),
    breakdown: summarizeRevenueBreakdown(reservations),
  };
}

/** Zero figures for accounts that may not see revenue. */
export const EMPTY_MOBILE_REPORTS: MobileReportsData = {
  bookings: 0,
  totalNights: 0,
  averageNights: null,
  upcomingNights: 0,
  stored: { knownCount: 0, unknownCount: 0, totalsByCurrency: [] },
  breakdown: { byMonth: [], byChannel: [], averageNightlyCents: [] },
};

/**
 * Hiding the tab is not hiding the data. Every mobile screen is rendered
 * from one payload, and the calendar is a client component — so whatever
 * the loader attaches ships to the browser and is readable in the page
 * source, whether or not a nav entry points at it. Accounts without the
 * reports section therefore get the empty figures, not merely no link.
 */
export function mobileReportsForAccess(
  access: MobileAccessLevel,
  input: Parameters<typeof summarizeMobileReports>[0],
): MobileReportsData {
  if (!canAccessMobileSection(access, "reports")) return EMPTY_MOBILE_REPORTS;
  return summarizeMobileReports(input);
}
