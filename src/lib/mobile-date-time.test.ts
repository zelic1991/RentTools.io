import { describe, expect, it } from "vitest";
import { propertyDateTimeFormat } from "./mobile-date-time";

describe("propertyDateTimeFormat", () => {
  it("shows Croatian wall-clock time, not the server's UTC", () => {
    // 14:20 UTC on 5 Nov 2026 is 15:20 in Zagreb (CET).
    expect(propertyDateTimeFormat("de-DE").format(new Date("2026-11-05T14:20:00Z"))).toBe("05.11.2026, 15:20");
  });

  it("follows summer time", () => {
    // 10:00 UTC on 1 Aug 2027 is 12:00 in Zagreb (CEST).
    expect(propertyDateTimeFormat("de-DE").format(new Date("2027-08-01T10:00:00Z"))).toBe("01.08.2027, 12:00");
  });
});
