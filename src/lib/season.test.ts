import { describe, expect, it } from "vitest";
import { currentOrNextSeason, monthInSeason, parseSeasonPatch, seasonDaysBetween, seasonOf } from "./season";

const summer = { start: 5, end: 9 };
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("seasonOf", () => {
  it("reads a stored May-September season", () => {
    expect(seasonOf({ seasonStartMonth: 5, seasonEndMonth: 9 })).toEqual(summer);
  });

  it("treats a missing or half-set pair as open all year", () => {
    expect(seasonOf({})).toBeNull();
    expect(seasonOf({ seasonStartMonth: 5, seasonEndMonth: null })).toBeNull();
    expect(seasonOf({ seasonStartMonth: 0, seasonEndMonth: 9 })).toBeNull();
  });
});

describe("parseSeasonPatch", () => {
  it("accepts two months or two nulls", () => {
    expect(parseSeasonPatch(5, 9)).toEqual({ start: 5, end: 9 });
    expect(parseSeasonPatch(null, null)).toEqual({ start: null, end: null });
  });

  it("rejects half pairs, strings and out-of-range months", () => {
    expect(parseSeasonPatch(5, null)).toBeNull();
    expect(parseSeasonPatch("5", 9)).toBeNull();
    expect(parseSeasonPatch(5, 13)).toBeNull();
    expect(parseSeasonPatch(undefined, 9)).toBeNull();
  });
});

describe("monthInSeason", () => {
  it("handles a summer season", () => {
    expect([4, 5, 9, 10].map((m) => monthInSeason(m, summer))).toEqual([false, true, true, false]);
  });

  it("handles a season that wraps the new year", () => {
    const winter = { start: 11, end: 3 };
    expect([10, 11, 1, 3, 4].map((m) => monthInSeason(m, winter))).toEqual([false, true, true, true, false]);
  });

  it("is always true without a season", () => {
    expect(monthInSeason(1, null)).toBe(true);
  });
});

describe("seasonDaysBetween", () => {
  it("counts every day without a season", () => {
    expect(seasonDaysBetween(d(2026, 9, 1), d(2026, 11, 1), null)).toBe(61);
  });

  it("counts only May-September days", () => {
    // Sept 2026 (30) + Oct 2026 (0)
    expect(seasonDaysBetween(d(2026, 9, 1), d(2026, 11, 1), summer)).toBe(30);
    // A whole year holds 153 season days
    expect(seasonDaysBetween(d(2027, 1, 1), d(2028, 1, 1), summer)).toBe(153);
  });

  it("clips a stay that runs out of the season", () => {
    // 28 Sep - 3 Oct: nights of 28, 29, 30 Sep count; 1, 2 Oct do not
    expect(seasonDaysBetween(d(2026, 9, 28), d(2026, 10, 3), summer)).toBe(3);
  });

  it("returns 0 for an empty or reversed range", () => {
    expect(seasonDaysBetween(d(2026, 9, 1), d(2026, 9, 1), summer)).toBe(0);
    expect(seasonDaysBetween(d(2026, 9, 2), d(2026, 9, 1), null)).toBe(0);
  });
});

describe("currentOrNextSeason", () => {
  it("points at next summer once this one is over", () => {
    const w = currentOrNextSeason(d(2026, 11, 5), summer)!;
    expect([w.year, w.from, w.to]).toEqual([2027, d(2027, 5, 1), d(2027, 10, 1)]);
  });

  it("keeps the running season while it lasts", () => {
    expect(currentOrNextSeason(d(2027, 9, 30), summer)!.year).toBe(2027);
  });

  it("handles a season across the new year", () => {
    const w = currentOrNextSeason(d(2027, 2, 10), { start: 11, end: 3 })!;
    expect([w.from, w.to]).toEqual([d(2026, 11, 1), d(2027, 4, 1)]);
  });

  it("is null without a season", () => {
    expect(currentOrNextSeason(d(2026, 11, 5), null)).toBeNull();
  });
});
