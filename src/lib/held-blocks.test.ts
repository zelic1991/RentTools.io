import { describe, expect, it } from "vitest";
import { findExpiredHolds } from "./held-blocks";

const june = Array.from({ length: 10 }, (_, i) => ({
  date: `2027-06-${String(14 + i).padStart(2, "0")}`,
  type: "closed",
  holdUntil: "2026-11-01",
}));

describe("findExpiredHolds", () => {
  it("reports the 14-23 June hold once its 1 November deadline has passed", () => {
    expect(findExpiredHolds(june, "2026-11-05")).toEqual([
      { from: "2027-06-14", to: "2027-06-24", holdUntil: "2026-11-01" },
    ]);
  });

  it("stays quiet while the hold is still running, including its last day", () => {
    expect(findExpiredHolds(june, "2026-11-01")).toEqual([]);
  });

  it("ignores blocks without a hold, open overrides and past days", () => {
    const rows = [
      { date: "2027-06-01", type: "closed", holdUntil: null },
      { date: "2027-06-02", type: "open", holdUntil: "2026-10-01" },
      { date: "2026-10-30", type: "closed", holdUntil: "2026-10-01" },
    ];
    expect(findExpiredHolds(rows, "2026-11-05")).toEqual([]);
  });

  it("splits at a gap and at a different deadline", () => {
    const rows = [
      { date: "2027-07-01", type: "closed", holdUntil: "2026-10-01" },
      { date: "2027-07-02", type: "closed", holdUntil: "2026-10-02" },
      { date: "2027-07-05", type: "closed", holdUntil: "2026-10-02" },
    ];
    expect(findExpiredHolds(rows, "2026-11-05").map((run) => [run.from, run.to])).toEqual([
      ["2027-07-01", "2027-07-02"],
      ["2027-07-02", "2027-07-03"],
      ["2027-07-05", "2027-07-06"],
    ]);
  });
});
