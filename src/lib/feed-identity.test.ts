import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  draftFindUnique: vi.fn(),
  draftUpdateMany: vi.fn(),
  propertyFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingDraft: {
      findUnique: mocks.draftFindUnique,
      updateMany: mocks.draftUpdateMany,
    },
    property: { findUnique: mocks.propertyFindUnique },
  },
}));

import {
  ensureOnboardingDraftFeedIdentity,
  mintFeedToken,
  mintNewPropertyFeedIdentity,
  mintUniqueFeedSlug,
} from "@/lib/feed-identity";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.draftFindUnique.mockResolvedValue(null);
  mocks.draftUpdateMany.mockResolvedValue({ count: 1 });
  mocks.propertyFindUnique.mockResolvedValue(null);
});

describe("secure feed identity", () => {
  it("mints independent cryptographic bearer tokens", () => {
    const first = mintFeedToken();
    const second = mintFeedToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(second).not.toBe(first);
  });

  it("checks property and onboarding namespaces before returning a durable slug", async () => {
    const slug = await mintUniqueFeedSlug("Sea View Apartment");

    expect(slug).toMatch(/^sea-view-apartment-[a-f0-9]{12}$/);
    expect(slug.length).toBeLessThanOrEqual(32);
    expect(mocks.propertyFindUnique).toHaveBeenCalledWith({
      where: { feedSlug: slug },
      select: { id: true },
    });
    expect(mocks.draftFindUnique).toHaveBeenCalledWith({
      where: { feedSlug: slug },
      select: { id: true },
    });
  });

  it("always returns both fields required for a new property", async () => {
    const identity = await mintNewPropertyFeedIdentity("Apartment");

    expect(identity.feedSlug).toMatch(/^apartment-[a-f0-9]{12}$/);
    expect(identity.feedToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("migrates a legacy draft atomically and returns the stored winner", async () => {
    mocks.draftFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        feedSlug: "legacy-draft-0123456789ab",
        feedToken: "stored-concurrent-token",
      });

    const identity = await ensureOnboardingDraftFeedIdentity({
      id: 44,
      propertyName: "Legacy Draft",
      feedSlug: null,
      feedToken: null,
    });

    expect(mocks.draftUpdateMany).toHaveBeenCalledWith({
      where: { id: 44, feedSlug: null, feedToken: null },
      data: {
        feedSlug: expect.stringMatching(/^legacy-draft-[a-f0-9]{12}$/),
        feedToken: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
      },
    });
    expect(identity).toEqual({
      feedSlug: "legacy-draft-0123456789ab",
      feedToken: "stored-concurrent-token",
    });
  });

  it("returns an existing draft identity byte-for-byte without rotating it", async () => {
    const identity = await ensureOnboardingDraftFeedIdentity({
      id: 45,
      propertyName: "Existing Draft",
      feedSlug: "already-published-slug",
      feedToken: "already-published-token",
    });

    expect(identity).toEqual({
      feedSlug: "already-published-slug",
      feedToken: "already-published-token",
    });
    expect(mocks.draftUpdateMany).not.toHaveBeenCalled();
  });
});
