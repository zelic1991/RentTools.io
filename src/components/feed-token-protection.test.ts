import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("feed-token UI protection contract", () => {
  it.each([
    "src/components/calendar-sync.tsx",
    "src/components/sync-settings.tsx",
  ])("does not offer a public-feed downgrade in %s", (path) => {
    const source = componentSource(path);

    expect(source).not.toContain('rotate-feed-token`, { method: "DELETE"');
    expect(source).not.toContain("handleClearToken");
    expect(source).not.toContain("makePublic");
  });

  it("tells owners that feeds are protected and identifies legacy migration state", () => {
    const calendarSync = componentSource("src/components/calendar-sync.tsx");
    const syncSettings = componentSource("src/components/sync-settings.tsx");

    expect(calendarSync).toContain("Feeds are protected by a private token");
    expect(calendarSync).toContain("This legacy feed is not protected yet");
    expect(syncSettings).toContain("Ihre Feeds sind durch ein privates Token geschützt");
    expect(syncSettings).toContain("Dieser ältere Feed ist noch nicht geschützt");
  });
});
