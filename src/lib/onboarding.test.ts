import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  draftFindUnique: vi.fn(),
  draftUpdate: vi.fn(),
  propertyCreate: vi.fn(),
  calendarCreate: vi.fn(),
  logAudit: vi.fn(),
  ensureOnboardingDraftFeedIdentity: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.cookieDelete,
    get: mocks.cookieGet,
  })),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/feed-identity", () => ({
  ensureOnboardingDraftFeedIdentity: mocks.ensureOnboardingDraftFeedIdentity,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendarLink: { create: mocks.calendarCreate },
    onboardingDraft: {
      findUnique: mocks.draftFindUnique,
      update: mocks.draftUpdate,
    },
    property: { create: mocks.propertyCreate },
  },
}));

import { claimOnboardingDraft } from "@/lib/onboarding";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookieGet.mockReturnValue({ value: "draft-cookie" });
  mocks.ensureOnboardingDraftFeedIdentity.mockResolvedValue({
    feedSlug: "existing-zelic-feed",
    feedToken: "existing-secure-feed-token",
  });
  mocks.propertyCreate.mockResolvedValue({ id: 51, name: "Vir Apartment" });
  mocks.draftUpdate.mockResolvedValue({});
});

describe("claimOnboardingDraft secure feed defaults", () => {
  it("preserves the exact protected identity already published before signup", async () => {
    mocks.draftFindUnique.mockResolvedValue({
      id: 8,
      claimedByUserId: null,
      feedSlug: "existing-zelic-feed",
      feedToken: "existing-secure-feed-token",
      links: "[]",
      propertyName: "Vir Apartment",
    });

    await claimOnboardingDraft(7);

    expect(mocks.ensureOnboardingDraftFeedIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        feedSlug: "existing-zelic-feed",
        feedToken: "existing-secure-feed-token",
      }),
    );
    expect(mocks.propertyCreate).toHaveBeenCalledWith({
      data: {
        name: "Vir Apartment",
        userId: 7,
        minNights: 1,
        feedSlug: "existing-zelic-feed",
        feedToken: "existing-secure-feed-token",
      },
    });
  });

  it("mints both missing feed fields for a legacy draft before property creation", async () => {
    mocks.ensureOnboardingDraftFeedIdentity.mockResolvedValue({
      feedSlug: "minted-property-0123456789ab",
      feedToken: "migrated-secure-feed-token",
    });
    mocks.draftFindUnique.mockResolvedValue({
      id: 9,
      claimedByUserId: null,
      feedSlug: null,
      feedToken: null,
      links: "[]",
      propertyName: "Vir Apartment",
    });

    await claimOnboardingDraft(7);

    expect(mocks.ensureOnboardingDraftFeedIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ propertyName: "Vir Apartment" }),
    );
    expect(mocks.propertyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feedSlug: "minted-property-0123456789ab",
        feedToken: "migrated-secure-feed-token",
      }),
    });
  });

  it("normalizes safe draft links and skips malformed links during claim", async () => {
    mocks.draftFindUnique.mockResolvedValue({
      id: 10,
      claimedByUserId: null,
      feedSlug: "existing-zelic-feed",
      feedToken: "existing-secure-feed-token",
      links: JSON.stringify([
        { platform: "Airbnb", icalExportUrl: "webcal://calendar.example/feed.ics" },
        { platform: "booking", icalExportUrl: "http://127.0.0.1/private" },
      ]),
      propertyName: "Vir Apartment",
    });
    mocks.calendarCreate.mockResolvedValue({ id: 77 });

    await claimOnboardingDraft(7);

    expect(mocks.calendarCreate).toHaveBeenCalledTimes(1);
    expect(mocks.calendarCreate).toHaveBeenCalledWith({
      data: {
        propertyId: 51,
        platform: "airbnb",
        icalExportUrl: "https://calendar.example/feed.ics",
        bufferBefore: 0,
        bufferAfter: 0,
      },
    });
  });
});
