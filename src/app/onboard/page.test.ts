import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/onboard/page.tsx"), "utf8");

describe("public onboarding protected feed URL contract", () => {
  it("hydrates and persists the complete draft identity", () => {
    expect(source).toContain("setFeedSlug(data.draft.feedSlug)");
    expect(source).toContain("setFeedToken(data.draft.feedToken)");
    expect(source).toContain("feedToken={feedToken}");
  });

  it("builds no slug-only public fallback", () => {
    expect(source).toContain("buildProtectedFeedUrl(origin, slug, token, platform)");
    expect(source).toContain("feedSlug && feedToken");
    expect(source).not.toContain("/api/calendar/feed/${slug}/for-${platform}.ics");
  });
});
