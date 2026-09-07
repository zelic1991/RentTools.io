import { describe, it, expect } from "vitest";
import { assignDirectSlots, directPaletteIndex, expandDateRange } from "./utils";

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

describe("directPaletteIndex", () => {
  it("stays within the palette", () => {
    for (const key of ["", "a", "Robert", "Gäste aus Polen", "r10", "r11"]) {
      const i = directPaletteIndex(key, 6);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(6);
    }
  });

  it("is deterministic for the same key", () => {
    expect(directPaletteIndex("Krajci", 6)).toBe(directPaletteIndex("Krajci", 6));
    expect(directPaletteIndex("r10", 6)).toBe(directPaletteIndex("r10", 6));
  });

  it("gives back-to-back reservation ids different colours", () => {
    // Bookings entered one after another get consecutive ids. djb2 makes
    // the hash of "r7" and "r8" differ by exactly one, so their slots
    // differ too — the pair most likely to sit side by side on the grid
    // never shares a colour. (Arbitrary pairs can collide; that is the
    // price of six slots.)
    for (const base of [0, 10, 20, 100]) {
      for (let n = base; n < base + 9; n++) {
        expect(directPaletteIndex(`r${n}`, 6)).not.toBe(directPaletteIndex(`r${n + 1}`, 6));
      }
    }
  });

  it("uses every slot of the palette", () => {
    const seen = new Set<number>();
    for (let n = 1; n <= 36; n++) seen.add(directPaletteIndex(`r${n}`, 6));
    expect(seen.size).toBe(6);
  });

  it("tolerates a zero-size palette", () => {
    expect(directPaletteIndex("anything", 0)).toBe(0);
  });
});

describe("assignDirectSlots", () => {
  it("never gives two neighbouring stays the same slot", () => {
    // Force collisions: pick four ids that all hash to the same slot.
    const target = directPaletteIndex("r3", 6);
    const keys: string[] = [];
    for (let n = 3; keys.length < 4 && n < 500; n++) {
      if (directPaletteIndex(`r${n}`, 6) === target) keys.push(`r${n}`);
    }
    expect(keys).toHaveLength(4);
    const slots = assignDirectSlots(keys, 6);
    for (let i = 1; i < keys.length; i++) {
      expect(slots.get(keys[i])).not.toBe(slots.get(keys[i - 1]));
    }
  });

  it("keeps the hashed slot when there is no collision", () => {
    const keys = ["r1", "r2", "r3"];
    const slots = assignDirectSlots(keys, 6);
    for (const k of keys) expect(slots.get(k)).toBe(directPaletteIndex(k, 6));
  });

  it("gives a stay that appears twice one slot", () => {
    const slots = assignDirectSlots(["r7", "r8", "r7"], 6);
    expect(slots.size).toBe(2);
  });

  it("stays inside the palette", () => {
    const slots = assignDirectSlots(["a", "b", "c", "d", "e", "f", "g"], 6);
    for (const v of slots.values()) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(6); }
  });
});
