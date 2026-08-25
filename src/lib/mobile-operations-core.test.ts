import { describe, expect, it } from "vitest";
import {
  canAccessMobileSection,
  mobileAvailabilityOverrides,
  deriveMobileGuestState,
  latestSubmissionStatus,
  reservationGuestCount,
  redactedPlatformLabel,
  safePlatformLabel,
  summarizeToday,
  type MobileReservationInput,
} from "@/lib/mobile-operations-core";

function reservation(overrides: Partial<MobileReservationInput> = {}): MobileReservationInput {
  return {
    id: 1,
    checkIn: "2027-08-07",
    checkOut: "2027-08-17",
    platform: "airbnb",
    bookedGuestCount: 4,
    persistedGuestCount: 0,
    submissions: [],
    eVisitorReceipts: [],
    ...overrides,
  };
}

describe("mobile operations start summary", () => {
  it("handles an empty property", () => {
    expect(summarizeToday([], "2027-08-07")).toEqual({
      arrivals: [],
      departures: [],
      occupied: [],
      next: null,
    });
  });

  it("reports one arrival as currently occupied", () => {
    const row = reservation();
    const result = summarizeToday([row], "2027-08-07");
    expect(result.arrivals).toEqual([row]);
    expect(result.occupied).toEqual([row]);
    expect(result.departures).toEqual([]);
  });

  it("reports multiple arrivals and the next future reservation", () => {
    const first = reservation({ id: 1 });
    const second = reservation({ id: 2, platform: "booking" });
    const next = reservation({ id: 3, checkIn: "2027-09-01", checkOut: "2027-09-04" });
    const result = summarizeToday([next, second, first], "2027-08-07");
    expect(result.arrivals.map((row) => row.id)).toEqual([2, 1]);
    expect(result.next?.id).toBe(3);
  });

  it("treats checkout as exclusive", () => {
    const row = reservation({ checkIn: "2027-08-01", checkOut: "2027-08-07" });
    const result = summarizeToday([row], "2027-08-07");
    expect(result.departures).toEqual([row]);
    expect(result.occupied).toEqual([]);
  });
});

describe("mobile guest state", () => {
  it("uses the latest real backend status", () => {
    expect(latestSubmissionStatus([
      { status: "INVITED", createdAt: "2027-01-01T00:00:00.000Z" },
      { status: "OWNER_REVIEW_REQUIRED", createdAt: "2027-01-02T00:00:00.000Z" },
    ])).toBe("OWNER_REVIEW_REQUIRED");
  });

  it("marks no data, partial data, complete and owner review", () => {
    expect(deriveMobileGuestState(reservation()).missingFields).toContain("Gästeformular noch nicht erstellt");
    expect(deriveMobileGuestState(reservation({ submissions: [{ status: "IN_PROGRESS", createdAt: "2027-01-01T00:00:00Z" }] })).complete).toBe(false);
    expect(deriveMobileGuestState(reservation({ submissions: [{ status: "OWNER_REVIEW_REQUIRED", createdAt: "2027-01-01T00:00:00Z" }] })).ownerReviewRequired).toBe(true);
    expect(deriveMobileGuestState(reservation({ submissions: [{ status: "OWNER_APPROVED", createdAt: "2027-01-01T00:00:00Z" }] })).complete).toBe(true);
  });

  it("never counts test eVisitor receipts as a production submission", () => {
    const state = deriveMobileGuestState(reservation({
      submissions: [{ status: "OWNER_APPROVED", createdAt: "2027-01-01T00:00:00Z" }],
      eVisitorReceipts: [{
        environment: "test",
        status: "success",
        readbackConfirmedAt: "2027-01-02T00:00:00Z",
        attemptedAt: "2027-01-02T00:00:00Z",
      }],
    }));
    expect(state.eVisitorStatus).toBe("READY_NOT_SUBMITTED");
  });

  it("shows only a production readback as confirmed", () => {
    const state = deriveMobileGuestState(reservation({
      submissions: [{ status: "OWNER_APPROVED", createdAt: "2027-01-01T00:00:00Z" }],
      eVisitorReceipts: [{
        environment: "production",
        status: "success",
        readbackConfirmedAt: "2027-01-02T00:00:00Z",
        attemptedAt: "2027-01-02T00:00:00Z",
      }],
    }));
    expect(state.eVisitorStatus).toBe("READBACK_CONFIRMED");
  });

  it("does not call a pending production receipt submitted", () => {
    const state = deriveMobileGuestState(reservation({
      submissions: [{ status: "OWNER_APPROVED", createdAt: "2027-01-01T00:00:00Z" }],
      eVisitorReceipts: [{
        environment: "production",
        status: "PENDING",
        readbackConfirmedAt: null,
        attemptedAt: "2027-01-02T00:00:00Z",
      }],
    }));
    expect(state.eVisitorStatus).toBe("PRODUCTION_PENDING");
  });

  it("prefers a confirmed party size and otherwise uses stored guest count", () => {
    expect(reservationGuestCount(reservation({ bookedGuestCount: 6, persistedGuestCount: 2 }))).toBe(6);
    expect(reservationGuestCount(reservation({ bookedGuestCount: null, persistedGuestCount: 2 }))).toBe(2);
    expect(reservationGuestCount(reservation({ bookedGuestCount: null, persistedGuestCount: 0 }))).toBeNull();
  });
});

describe("mobile role boundary", () => {
  it("allows managers to read every mobile section", () => {
    for (const section of ["start", "calendar", "guests", "portals"] as const) {
      expect(canAccessMobileSection("owner", section)).toBe(true);
    }
    expect(canAccessMobileSection("manager", "start")).toBe(true);
    expect(canAccessMobileSection("manager", "calendar")).toBe(true);
    expect(canAccessMobileSection("manager", "guests")).toBe(true);
    expect(canAccessMobileSection("manager", "portals")).toBe(true);
  });

  it("keeps the optional cleaner role out of this PWA", () => {
    expect(canAccessMobileSection("cleaner", "start")).toBe(false);
    expect(canAccessMobileSection("cleaner", "calendar")).toBe(false);
    expect(canAccessMobileSection("cleaner", "guests")).toBe(false);
    expect(canAccessMobileSection("cleaner", "portals")).toBe(false);
  });
});

describe("mobile same-day turnover", () => {
  it("keeps cleaning metadata out of mobile availability while preserving real overrides", () => {
    expect(mobileAvailabilityOverrides([
      { date: "2027-05-20", type: "cleaning" },
      { date: "2027-05-21", type: "closed" },
      { date: "2027-05-22", type: "open" },
    ])).toEqual([
      { date: "2027-05-21", type: "closed" },
      { date: "2027-05-22", type: "open" },
    ]);
  });
});

describe("platform labels", () => {
  it("uses human-readable channel names", () => {
    expect(safePlatformLabel("booking")).toBe("Booking.com");
    expect(safePlatformLabel("laganini-manual")).toBe("Laganini");
    expect(safePlatformLabel("reklama-hr")).toBe("REKLAMA/Ubytování");
    expect(redactedPlatformLabel("guest-Jass-Sidhu")).toBe("Sonstige");
  });
});
