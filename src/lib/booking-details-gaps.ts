/**
 * Booking.com and Airbnb only send dates over iCal: no guest name, no price,
 * no party size. Until the host types those in, the booking is missing from
 * the guest list and from the money and channel figures in the reports.
 *
 * This finds every upcoming portal booking that still lacks one of those
 * details, so the phone can list them as open items with a button to fill
 * them in. It is read-only and never guesses a value.
 */

import { isHostBlockSummary } from "@/lib/mobile-reports-core";

export type MissingBookingDetail = "name" | "amount" | "guests";

export const PORTAL_PLATFORMS = ["booking", "airbnb"] as const;

export interface GapEventInput {
  platform: string;
  uid: string;
  summary: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD, exclusive
}

export interface GapReservationInput {
  id: number;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD, exclusive
  platform: string;
  linkedEventUid: string | null;
  linkedEventPlatform: string | null;
  linkedEventRole: string | null;
  bookedGuestCount: number | null;
  grossAmountCents: number | null;
}

export interface BookingDetailsGap {
  /** "event" = iCal booking nobody has named yet; "reservation" = named but incomplete. */
  kind: "event" | "reservation";
  platform: string;
  startDate: string;
  endDate: string;
  reservationId: number | null;
  missing: MissingBookingDetail[];
}

function isPortal(platform: string | null | undefined): boolean {
  return PORTAL_PLATFORMS.includes((platform ?? "").toLowerCase() as (typeof PORTAL_PLATFORMS)[number]);
}

/**
 * Whether an iCal event is a guest booking rather than the host's own block.
 *
 * Airbnb marks its blocks "Airbnb (Not available)" and bookings "Reserved",
 * so the shared block test works there. Booking.com exports every stay as
 * "CLOSED - Not available", bookings included, so that test would drop all
 * of them; only RentTools' own reflected buffer blocks are skipped there.
 */
export function isPortalBookingEvent(event: Pick<GapEventInput, "platform" | "summary">): boolean {
  const platform = event.platform.toLowerCase();
  if (platform === "airbnb") return !isHostBlockSummary(event.summary);
  if (platform === "booking") return !(event.summary ?? "").includes("Blocked");
  return false;
}

function claimsEvent(reservation: GapReservationInput, event: GapEventInput): boolean {
  if (reservation.linkedEventUid !== event.uid) return false;
  if (reservation.linkedEventRole === "extension") return false;
  const source = (reservation.linkedEventPlatform ?? reservation.platform).toLowerCase();
  return source === event.platform.toLowerCase();
}

/** Upcoming portal bookings that still need a name, an amount or a party size. */
export function findBookingDetailsGaps(input: {
  events: GapEventInput[];
  reservations: GapReservationInput[];
  /** YYYY-MM-DD in the property's time zone. Stays that ended before it are ignored. */
  today: string;
}): BookingDetailsGap[] {
  const gaps: BookingDetailsGap[] = [];

  for (const event of input.events) {
    if (event.endDate <= input.today) continue;
    if (!isPortalBookingEvent(event)) continue;
    if (input.reservations.some((reservation) => claimsEvent(reservation, event))) continue;
    gaps.push({
      kind: "event",
      platform: event.platform.toLowerCase(),
      startDate: event.startDate,
      endDate: event.endDate,
      reservationId: null,
      missing: ["name", "amount", "guests"],
    });
  }

  for (const reservation of input.reservations) {
    if (reservation.checkOut <= input.today) continue;
    if (!isPortal(reservation.platform)) continue;
    const missing: MissingBookingDetail[] = [];
    if (reservation.grossAmountCents === null) missing.push("amount");
    if (reservation.bookedGuestCount === null) missing.push("guests");
    if (missing.length === 0) continue;
    gaps.push({
      kind: "reservation",
      platform: reservation.platform.toLowerCase(),
      startDate: reservation.checkIn,
      endDate: reservation.checkOut,
      reservationId: reservation.id,
      missing,
    });
  }

  return gaps.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
