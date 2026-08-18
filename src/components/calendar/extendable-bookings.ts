import type { Property } from "@/lib/types";
import type { ExtendableBooking } from "@/components/date-actions-popover";
import { addDaysStr } from "./utils";
import type { CalendarEvent } from "./types";

function reservationDate(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return new Date(value).toISOString().slice(0, 10);
}

function sourceKey(platform: string, uid: string): string {
  return `${platform}\u0000${uid}`;
}

function isHostBlock(event: CalendarEvent): boolean {
  const summary = event.summary || "";
  return (
    summary.includes("Not available") ||
    summary.includes("Blocked") ||
    summary.includes("CLOSED")
  );
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

function pushAdjacentCandidates(
  result: ExtendableBooking[],
  selectionStart: string,
  dayAfterSelection: string,
  booking: Omit<ExtendableBooking, "side">,
) {
  if (booking.bookingStart === dayAfterSelection) {
    result.push({ ...booking, side: "before" });
  }
  // Stay ranges are half-open: bookingEnd is the checkout date and
  // therefore the first free night the host can select. A [19, 23)
  // stay is extended by selecting the night of the 23rd, not the 24th.
  if (booking.bookingEnd === selectionStart) {
    result.push({ ...booking, side: "after" });
  }
}

/**
 * Find a booking that a contiguous, night-based selection can extend.
 * `startDate` and `endDate` are both selected nights (inclusive); the
 * resulting checkout is therefore the day after `endDate`.
 */
export function getExtendableBookings(
  startDate: string,
  endDate: string,
  syncedEvents: CalendarEvent[],
  reservations: Property["reservations"],
): ExtendableBooking[] {
  const result: ExtendableBooking[] = [];
  const dayAfterRange = addDaysStr(endDate, 1);
  const claimedSources = new Set<string>();

  // Prefer a manageable local Reservation whenever it is the named
  // claim for an iCal event. Besides preserving the guest name, PATCHing
  // that row avoids creating a second linked extension for the same stay.
  for (const reservation of reservations) {
    const rStart = reservationDate(reservation.checkIn);
    const rEnd = reservationDate(reservation.checkOut);
    const platform = reservation.platform || "airbnb";
    const linkedSource = reservation.linkedEventUid
      ? syncedEvents.find(
          (event) =>
            event.platform === platform && event.uid === reservation.linkedEventUid,
        )
      : undefined;

    if (
      linkedSource &&
      overlaps(rStart, rEnd, linkedSource.startDate, linkedSource.endDate)
    ) {
      claimedSources.add(sourceKey(linkedSource.platform, linkedSource.uid));
      pushAdjacentCandidates(result, startDate, dayAfterRange, {
        name: reservation.name,
        platform,
        reservationId: reservation.id,
        bookingStart:
          rStart < linkedSource.startDate ? rStart : linkedSource.startDate,
        bookingEnd: rEnd > linkedSource.endDate ? rEnd : linkedSource.endDate,
      });
      continue;
    }

    // Legacy rows can overlap a source event without linkedEventUid.
    // The calendar already renders that pair as one named bar, so treat
    // the local row as the manageable target and use the same union. The
    // PATCH endpoint recognizes this implicit relationship and excludes
    // only the already-overlapping source event from its conflict check.
    const implicitSource = !reservation.linkedEventUid
      ? syncedEvents.find(
          (event) =>
            event.platform === platform &&
            overlaps(rStart, rEnd, event.startDate, event.endDate),
        )
      : undefined;
    if (implicitSource) {
      const key = sourceKey(implicitSource.platform, implicitSource.uid);
      claimedSources.add(key);
      pushAdjacentCandidates(result, startDate, dayAfterRange, {
        name: reservation.name,
        platform,
        reservationId: reservation.id,
        bookingStart:
          rStart < implicitSource.startDate ? rStart : implicitSource.startDate,
        bookingEnd:
          rEnd > implicitSource.endDate ? rEnd : implicitSource.endDate,
      });
      continue;
    }

    // Pure manual reservations and non-overlapping linked extension
    // segments are directly editable.
    pushAdjacentCandidates(result, startDate, dayAfterRange, {
      name: reservation.name,
      platform,
      reservationId: reservation.id,
      bookingStart: rStart,
      bookingEnd: rEnd,
    });
  }

  for (const event of syncedEvents) {
    const key = sourceKey(event.platform, event.uid);
    if (claimedSources.has(key)) continue;

    if (isHostBlock(event)) continue;

    pushAdjacentCandidates(result, startDate, dayAfterRange, {
      name:
        event.summary ||
        (event.platform === "airbnb" ? "Airbnb" : "Booking"),
      platform: event.platform,
      eventUid: event.uid,
      bookingStart: event.startDate,
      bookingEnd: event.endDate,
    });
  }

  return result;
}

/** Exact stay window shown in the confirmation card after extension. */
export function getExtendedStayRange(
  rangeStart: string,
  rangeEnd: string,
  booking: ExtendableBooking,
): { checkIn: string; checkOut: string } {
  return booking.side === "before"
    ? { checkIn: rangeStart, checkOut: booking.bookingEnd }
    : { checkIn: booking.bookingStart, checkOut: addDaysStr(rangeEnd, 1) };
}

/** Minimal PATCH body for extending an existing Reservation row. */
export function buildManualExtensionPatch(
  rangeStart: string,
  rangeEnd: string,
  booking: ExtendableBooking,
): { checkIn: string } | { checkOut: string } {
  const extended = getExtendedStayRange(rangeStart, rangeEnd, booking);
  return booking.side === "before"
    ? { checkIn: extended.checkIn }
    : { checkOut: extended.checkOut };
}
