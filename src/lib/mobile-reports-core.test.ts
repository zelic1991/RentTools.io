import { describe, expect, it } from "vitest";
import {
  isHostBlockSummary,
  mobileReportsForAccess,
  summarizeMobileReports,
  type MobileReportsEvent,
  type MobileReportsReservation,
} from "@/lib/mobile-reports-core";

function reservation(
  overrides: Partial<MobileReportsReservation> = {},
): MobileReportsReservation {
  return {
    checkIn: "2026-09-20",
    checkOut: "2026-09-25",
    platform: "direct",
    grossAmountCents: 50000,
    currency: "EUR",
    linkedEventPlatform: null,
    linkedEventUid: null,
    linkedEventRole: null,
    ...overrides,
  };
}

function event(overrides: Partial<MobileReportsEvent> = {}): MobileReportsEvent {
  return {
    platform: "airbnb",
    uid: "evt-1@airbnb.com",
    startDate: "2026-09-20",
    endDate: "2026-09-25",
    ...overrides,
  };
}

const WINDOW = { today: "2026-09-12", untilCheckout: "2027-09-12" };

describe("mobile reports summary", () => {
  it("says nothing rather than zero-euro on an empty property", () => {
    const result = summarizeMobileReports({ reservations: [], events: [], ...WINDOW });
    expect(result.bookings).toBe(0);
    expect(result.averageNights).toBeNull();
    expect(result.upcomingNights).toBe(0);
    expect(result.stored.totalsByCurrency).toEqual([]);
  });

  it("counts only stored amounts and keeps the rest unknown", () => {
    const result = summarizeMobileReports({
      reservations: [
        reservation({ grossAmountCents: 12345 }),
        reservation({ checkIn: "2026-10-01", checkOut: "2026-10-03", grossAmountCents: null }),
      ],
      events: [],
      ...WINDOW,
    });
    expect(result.stored.knownCount).toBe(1);
    expect(result.stored.unknownCount).toBe(1);
    expect(result.stored.totalsByCurrency).toEqual([{ currency: "EUR", amountCents: 12345 }]);
    expect(result.bookings).toBe(2);
    // 5 nights + 2 nights over two bookings.
    expect(result.averageNights).toBe(3.5);
  });

  it("splits stored amounts by check-in month and channel", () => {
    const result = summarizeMobileReports({
      reservations: [
        reservation({ platform: "airbnb", grossAmountCents: 20000 }),
        reservation({
          checkIn: "2026-10-05",
          checkOut: "2026-10-07",
          platform: "booking",
          grossAmountCents: 10000,
        }),
      ],
      events: [],
      ...WINDOW,
    });
    expect(result.breakdown.byMonth.map((row) => [row.month, row.amountCents])).toEqual([
      ["2026-09", 20000],
      ["2026-10", 10000],
    ]);
    expect(result.breakdown.byChannel.map((row) => row.platform)).toEqual(["airbnb", "booking"]);
  });

  it("clips upcoming nights to the booking window", () => {
    const result = summarizeMobileReports({
      reservations: [
        // Started before today: only the nights from today count.
        reservation({ checkIn: "2026-09-10", checkOut: "2026-09-15" }),
        // Runs past the window end.
        reservation({ checkIn: "2027-09-10", checkOut: "2027-09-20" }),
      ],
      events: [],
      ...WINDOW,
    });
    expect(result.upcomingNights).toBe(3 + 2);
  });

  it("keeps the last bookable night of the window", () => {
    // The window ends with a checkout bound, not with the last night. The
    // earlier version clipped against the night and lost it.
    const result = summarizeMobileReports({
      reservations: [reservation({ checkIn: "2027-09-10", checkOut: "2027-09-13" })],
      events: [],
      today: "2026-09-12",
      untilCheckout: "2027-09-13",
    });
    expect(result.upcomingNights).toBe(3);
  });

  it("leaves the host's own blocked days out, like the desktop does", () => {
    // Live data made this obvious: with the winter closure counted, the
    // phone said 246 nights ahead where the desktop said 48 — same flat,
    // same day. Blocks are occupancy, not business.
    expect(isHostBlockSummary("Airbnb (Not available)")).toBe(true);
    expect(isHostBlockSummary("CLOSED - Not available")).toBe(true);
    expect(isHostBlockSummary("Blocked")).toBe(true);
    expect(isHostBlockSummary("Krajci")).toBe(false);
    expect(isHostBlockSummary(null)).toBe(false);
  });

  it("counts a claimed event once, not twice", () => {
    const shared = { startDate: "2026-09-20", endDate: "2026-09-25" };
    const result = summarizeMobileReports({
      reservations: [
        reservation({
          linkedEventPlatform: "airbnb",
          linkedEventUid: "evt-1@airbnb.com",
          linkedEventRole: "claim",
          platform: "airbnb",
        }),
      ],
      events: [event(shared)],
      ...WINDOW,
    });
    expect(result.upcomingNights).toBe(5);
  });

  it("counts a night once when two platforms export the same stay", () => {
    const result = summarizeMobileReports({
      reservations: [],
      events: [
        event({ platform: "airbnb", uid: "a@airbnb.com" }),
        event({ platform: "booking", uid: "b@booking.com" }),
      ],
      ...WINDOW,
    });
    expect(result.upcomingNights).toBe(5);
  });

  it("adds a direct extension that only abuts its source event", () => {
    // The real case from 12.09.2026: an Airbnb block that ends on the 12th
    // and a direct reservation for the night of the 12th. The window starts
    // today, so only the extension night is ahead — and it must survive.
    const result = summarizeMobileReports({
      reservations: [
        reservation({
          checkIn: "2026-09-12",
          checkOut: "2026-09-13",
          platform: "direct",
          linkedEventPlatform: "airbnb",
          linkedEventUid: "block@airbnb.com",
          linkedEventRole: "extension",
        }),
      ],
      events: [
        event({ uid: "block@airbnb.com", startDate: "2026-09-09", endDate: "2026-09-12" }),
      ],
      ...WINDOW,
    });
    expect(result.upcomingNights).toBe(1);
  });
});

describe("who the figures are computed for", () => {
  // The whole payload is serialised into the page for the client
  // calendar, so a role that must not see revenue must not have it
  // attached at all — hiding the nav entry would leave it in the source.
  const input = {
    reservations: [reservation({ grossAmountCents: 98765 })],
    events: [],
    ...WINDOW,
  };

  it("gives owner and manager the real numbers", () => {
    for (const access of ["owner", "manager"] as const) {
      const result = mobileReportsForAccess(access, input);
      expect(result.stored.totalsByCurrency, access).toEqual([
        { currency: "EUR", amountCents: 98765 },
      ]);
      expect(result.bookings, access).toBe(1);
    }
  });

  it("attaches no amount at all for family and cleaner", () => {
    for (const access of ["family", "cleaner"] as const) {
      const result = mobileReportsForAccess(access, input);
      expect(JSON.stringify(result), access).not.toContain("98765");
      expect(result.stored.totalsByCurrency, access).toEqual([]);
      expect(result.stored.knownCount, access).toBe(0);
      expect(result.breakdown.byMonth, access).toEqual([]);
      expect(result.breakdown.byChannel, access).toEqual([]);
      expect(result.bookings, access).toBe(0);
      expect(result.upcomingNights, access).toBe(0);
    }
  });
});
