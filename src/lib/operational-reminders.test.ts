import { describe, expect, it } from "vitest";
import {
  isIsoDate,
  isOpenOperationalReminder,
  operationalReminderDedupeKey,
  parseDueAt,
} from "./operational-reminders";

describe("operational reminders", () => {
  it("builds a stable PII-free key for one external portal hold", () => {
    const first = operationalReminderDedupeKey({
      propertyId: 1,
      type: "PORTAL_FOLLOW_UP",
      portal: " Booking ",
      startDate: "2027-07-18",
      endDate: "2027-08-06",
    });
    const second = operationalReminderDedupeKey({
      propertyId: 1,
      type: "PORTAL_FOLLOW_UP",
      portal: "booking",
      startDate: "2027-07-18",
      endDate: "2027-08-06",
    });

    expect(first).toBe(second);
    expect(first).toBe("1|PORTAL_FOLLOW_UP|booking|2027-07-18|2027-08-06");
  });

  it("validates the date and review timestamp boundary", () => {
    expect(isIsoDate("2027-08-06")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("06.08.2027")).toBe(false);
    expect(isIsoDate("2027-99-99")).toBe(false);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(parseDueAt("2026-09-05T12:00:00.000Z")?.toISOString())
      .toBe("2026-09-05T12:00:00.000Z");
    expect(parseDueAt("not-a-date")).toBeNull();
  });

  it("keeps completion explicit instead of auto-expiring the hold", () => {
    expect(isOpenOperationalReminder({ status: "OPEN" })).toBe(true);
    expect(isOpenOperationalReminder({ status: "DONE" })).toBe(false);
    expect(isOpenOperationalReminder({ status: "OVERDUE" })).toBe(false);
  });
});
