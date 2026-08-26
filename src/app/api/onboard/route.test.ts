import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  draftCreate: vi.fn(),
  draftFindUnique: vi.fn(),
  draftUpdate: vi.fn(),
  ensureIdentity: vi.fn(),
  mintIdentity: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
  })),
}));
vi.mock("@/lib/feed-identity", () => ({
  ensureOnboardingDraftFeedIdentity: mocks.ensureIdentity,
  mintNewPropertyFeedIdentity: mocks.mintIdentity,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingDraft: {
      create: mocks.draftCreate,
      findUnique: mocks.draftFindUnique,
      update: mocks.draftUpdate,
    },
  },
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mintIdentity.mockResolvedValue({
    feedSlug: "vir-draft-0123456789ab",
    feedToken: "draft-secure-token",
  });
  mocks.ensureIdentity.mockResolvedValue({
    feedSlug: "vir-draft-0123456789ab",
    feedToken: "draft-secure-token",
  });
});

describe("/api/onboard protected draft identity", () => {
  it("creates every new draft with a cryptographic token and durable slug", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.draftCreate.mockResolvedValue({
      id: 12,
      sessionToken: "cookie-token",
      propertyName: "Vir Apartment",
      feedSlug: "vir-draft-0123456789ab",
      feedToken: "draft-secure-token",
      links: "[]",
      createdAt: new Date("2026-08-26T00:00:00.000Z"),
    });

    const response = await POST(new NextRequest("http://localhost/api/onboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyName: "Vir Apartment", links: [] }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.draftCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyName: "Vir Apartment",
        feedSlug: "vir-draft-0123456789ab",
        feedToken: "draft-secure-token",
      }),
    });
    await expect(response.json()).resolves.toEqual({
      draft: expect.objectContaining({
        feedSlug: "vir-draft-0123456789ab",
        feedToken: "draft-secure-token",
      }),
    });
  });

  it("migrates a cookie-authorized legacy draft before returning its URL identity", async () => {
    mocks.cookieGet.mockReturnValue({ value: "legacy-cookie" });
    mocks.draftFindUnique.mockResolvedValue({
      id: 13,
      sessionToken: "legacy-cookie",
      propertyName: "Legacy Vir",
      feedSlug: "legacy-vir",
      feedToken: null,
      links: "[]",
      claimedByUserId: null,
      createdAt: new Date("2026-08-25T00:00:00.000Z"),
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.ensureIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 13, feedToken: null }),
    );
    await expect(response.json()).resolves.toEqual({
      draft: expect.objectContaining({
        feedSlug: "vir-draft-0123456789ab",
        feedToken: "draft-secure-token",
      }),
    });
  });
});
