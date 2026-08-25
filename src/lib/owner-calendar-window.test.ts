import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  dateInTimeZone,
  getOwnerCalendarWindow,
  isOwnerCalendarOccupancyDate,
  isReservationRangeInOwnerCalendarWindow,
  ownerCalendarMonthStarts,
} from "./owner-calendar-window";

describe("owner calendar rolling window", () => {
  const now = new Date("2026-08-25T22:30:00.000Z");
  const window = getOwnerCalendarWindow({
    bookingWindowDays: 365,
    timeZone: "Europe/Zagreb",
    now,
  });

  it("uses the property timezone instead of the server UTC day", () => {
    expect(dateInTimeZone(now, "UTC")).toBe("2026-08-25");
    expect(dateInTimeZone(now, "Europe/Zagreb")).toBe("2026-08-26");
    expect(window.today).toBe("2026-08-26");
  });

  it("renders the current month through the partially visible final month", () => {
    const months = ownerCalendarMonthStarts(window);
    expect(months).toContain("2026-08-01");
    expect(months.at(-1)).toBe("2027-08-01");
    expect(window.visibleUntil).toBe("2027-08-26");
  });

  it("keeps the confirmed August 2027 stay writable", () => {
    expect(isReservationRangeInOwnerCalendarWindow("2027-08-07", "2027-08-17", window)).toBe(true);
  });

  it("accepts the last occupancy day with checkout on the next day", () => {
    expect(isOwnerCalendarOccupancyDate(window.visibleUntil, window)).toBe(true);
    expect(isReservationRangeInOwnerCalendarWindow(
      window.visibleUntil,
      window.checkoutUntil,
      window,
    )).toBe(true);
  });

  it("rejects the first occupancy day beyond the window", () => {
    const firstOutside = addCalendarDays(window.visibleUntil, 1);
    expect(isOwnerCalendarOccupancyDate(firstOutside, window)).toBe(false);
    expect(isReservationRangeInOwnerCalendarWindow(
      firstOutside,
      addCalendarDays(firstOutside, 1),
      window,
    )).toBe(false);
  });

  it("crosses year boundaries and leap days by calendar date", () => {
    const leapWindow = getOwnerCalendarWindow({
      bookingWindowDays: 365,
      timeZone: "Europe/Zagreb",
      now: new Date("2023-03-01T11:00:00.000Z"),
      pastMonths: 0,
    });
    expect(leapWindow.visibleUntil).toBe("2024-02-29");
    expect(ownerCalendarMonthStarts(leapWindow).at(-1)).toBe("2024-02-01");
  });

  it("keeps DST changes from shifting date-only arithmetic", () => {
    expect(addCalendarDays("2027-03-27", 1)).toBe("2027-03-28");
    expect(addCalendarDays("2027-03-28", 1)).toBe("2027-03-29");
  });
});

