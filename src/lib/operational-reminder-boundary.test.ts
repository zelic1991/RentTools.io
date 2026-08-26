import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("OperationalReminder availability boundary", () => {
  it("stays outside calendar sync, availability calculation, and public iCal", () => {
    expect(source("src/lib/calendar-sync.ts")).not.toContain("operationalReminder");
    expect(source("src/lib/feed.ts")).not.toContain("operationalReminder");
    expect(source("src/components/calendar/use-calendar-data.ts")).not.toContain("operationalReminder");
  });

  it("uses the redacted cleaner occupancy endpoint instead of raw sync data", () => {
    const cleaner = source("src/components/cleaner-app.tsx");
    expect(cleaner).toContain("/api/calendar/occupancy");
    expect(cleaner).not.toContain("/api/calendar/sync?propertyId=");
  });
});
