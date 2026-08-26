import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/dashboard-onboarding.tsx"),
  "utf8",
);

describe("dashboard onboarding protected-feed wiring", () => {
  it("uses the server-minted identity returned to the creating owner", () => {
    expect(source).toContain("property.feedSlug");
    expect(source).toContain("property.feedToken");
    expect(source).toContain("setFeedIdentity");
    expect(source).toContain("buildProtectedFeedUrl");
  });

  it("does not fall back to a numeric or tokenless outbound URL", () => {
    expect(source).not.toContain("/api/calendar/feed/${propertyId}/for-${platform}.ics");
    expect(source).toContain("Protected feed URL unavailable");
    expect(source).toContain("disabled={!outboundFeedUrl}");
  });

  it("keeps the wizard open after save until the owner explicitly finishes", () => {
    const savePlatformBody = source.slice(
      source.indexOf("const savePlatform"),
      source.indexOf("const feedUrl"),
    );

    expect(savePlatformBody).not.toContain("onComplete()");
    expect(source).toContain("savedLinks.length > 0");
    expect(source).toContain("onClick={onComplete}");
    expect(source).toContain("Weiter zum Dashboard");
  });
});
