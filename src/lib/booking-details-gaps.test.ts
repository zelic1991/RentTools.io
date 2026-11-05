import { describe, expect, it } from "vitest";
import {
  findBookingDetailsGaps,
  isPortalBookingEvent,
  type GapEventInput,
  type GapReservationInput,
} from "./booking-details-gaps";

const today = "2026-11-05";

function event(over: Partial<GapEventInput> = {}): GapEventInput {
  return {
    platform: "booking",
    uid: "uid-garda",
    summary: "CLOSED - Not available",
    startDate: "2027-08-01",
    endDate: "2027-08-07",
    ...over,
  };
}

function reservation(over: Partial<GapReservationInput> = {}): GapReservationInput {
  return {
    id: 18,
    checkIn: "2027-08-01",
    checkOut: "2027-08-07",
    platform: "booking",
    linkedEventUid: "uid-garda",
    linkedEventPlatform: "booking",
    linkedEventRole: "claim",
    bookedGuestCount: null,
    grossAmountCents: null,
    ...over,
  };
}

describe("isPortalBookingEvent", () => {
  it("keeps Booking.com stays even though Booking labels them CLOSED", () => {
    expect(isPortalBookingEvent(event())).toBe(true);
  });

  it("skips RentTools' own reflected buffer blocks", () => {
    expect(isPortalBookingEvent(event({ summary: "Blocked (cleaning)" }))).toBe(false);
  });

  it("tells Airbnb bookings from Airbnb blocks", () => {
    expect(isPortalBookingEvent(event({ platform: "airbnb", summary: "Reserved" }))).toBe(true);
    expect(isPortalBookingEvent(event({ platform: "airbnb", summary: "Airbnb (Not available)" }))).toBe(false);
  });

  it("ignores other platforms", () => {
    expect(isPortalBookingEvent(event({ platform: "direct", summary: "Reserved" }))).toBe(false);
  });
});

describe("findBookingDetailsGaps", () => {
  it("flags a new Booking stay nobody has named yet (the 1–7 Aug 2027 case)", () => {
    expect(findBookingDetailsGaps({ events: [event()], reservations: [], today })).toEqual([
      {
        kind: "event",
        platform: "booking",
        startDate: "2027-08-01",
        endDate: "2027-08-07",
        reservationId: null,
        missing: ["name", "amount", "guests"],
      },
    ]);
  });

  it("asks only for what is still missing once the stay is named", () => {
    const gaps = findBookingDetailsGaps({ events: [event()], reservations: [reservation()], today });
    expect(gaps).toEqual([
      {
        kind: "reservation",
        platform: "booking",
        startDate: "2027-08-01",
        endDate: "2027-08-07",
        reservationId: 18,
        missing: ["amount", "guests"],
      },
    ]);
  });

  it("is quiet when name, amount and party size are all there", () => {
    const done = reservation({ grossAmountCents: 88300, bookedGuestCount: 6 });
    expect(findBookingDetailsGaps({ events: [event()], reservations: [done], today })).toEqual([]);
  });

  it("does not count a direct extension as naming the portal stay", () => {
    const extension = reservation({ platform: "direct", linkedEventRole: "extension", checkIn: "2027-08-07", checkOut: "2027-08-09" });
    const gaps = findBookingDetailsGaps({ events: [event()], reservations: [extension], today });
    expect(gaps.map((gap) => gap.kind)).toEqual(["event"]);
  });

  it("matches the claim on platform as well as UID", () => {
    const otherPlatform = reservation({ linkedEventPlatform: "airbnb", platform: "airbnb", grossAmountCents: 1, bookedGuestCount: 2 });
    const gaps = findBookingDetailsGaps({ events: [event()], reservations: [otherPlatform], today });
    expect(gaps.map((gap) => gap.kind)).toEqual(["event"]);
  });

  it("accepts legacy claims that have no linkedEventPlatform", () => {
    const legacy = reservation({ linkedEventPlatform: null, linkedEventRole: null, grossAmountCents: 1, bookedGuestCount: 2 });
    expect(findBookingDetailsGaps({ events: [event()], reservations: [legacy], today })).toEqual([]);
  });

  it("ignores past stays, direct bookings and host blocks", () => {
    const gaps = findBookingDetailsGaps({
      events: [
        event({ uid: "past", startDate: "2026-10-01", endDate: "2026-10-05" }),
        event({ uid: "block", platform: "airbnb", summary: "Airbnb (Not available)" }),
      ],
      reservations: [reservation({ id: 3, platform: "direct", linkedEventUid: null, linkedEventPlatform: null, linkedEventRole: null })],
      today,
    });
    expect(gaps).toEqual([]);
  });

  it("lists the earliest arrival first", () => {
    const gaps = findBookingDetailsGaps({
      events: [event(), event({ uid: "june", startDate: "2027-06-30", endDate: "2027-07-04" })],
      reservations: [],
      today,
    });
    expect(gaps.map((gap) => gap.startDate)).toEqual(["2027-06-30", "2027-08-01"]);
  });
});
