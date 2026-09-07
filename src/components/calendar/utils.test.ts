import { describe, it, expect } from "vitest";
import { expandDateRange } from "./utils";

describe("expandDateRange", () => {
  it("returns a single date when both ends are the same", () => {
    expect(expandDateRange("2027-08-17", "2027-08-17")).toEqual(["2027-08-17"]);
  });

  it("expands a forward range inclusively", () => {
    expect(expandDateRange("2027-08-17", "2027-08-20")).toEqual([
      "2027-08-17",
      "2027-08-18",
      "2027-08-19",
      "2027-08-20",
    ]);
  });

  it("expands a backward range the same way", () => {
    expect(expandDateRange("2027-08-20", "2027-08-17")).toEqual([
      "2027-08-17",
      "2027-08-18",
      "2027-08-19",
      "2027-08-20",
    ]);
  });

  it("crosses a month boundary", () => {
    expect(expandDateRange("2027-07-30", "2027-08-02")).toEqual([
      "2027-07-30",
      "2027-07-31",
      "2027-08-01",
      "2027-08-02",
    ]);
  });

  it("crosses a leap day", () => {
    expect(expandDateRange("2028-02-28", "2028-03-01")).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(expandDateRange("2026-12-31", "2027-01-02")).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("covers a realistic 10-night stay in two clicks", () => {
    // Krajci: 17–27 Aug 2027. Shift-clicking the two ends must select
    // every night in between, so the popover offers one 10-night
    // reservation instead of ten single-day toggles.
    expect(expandDateRange("2027-08-17", "2027-08-27")).toHaveLength(11);
  });
});
