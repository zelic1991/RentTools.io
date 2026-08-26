import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  mintNewPropertyFeedIdentity: vi.fn(),
  propertyCreate: vi.fn(),
  reservationCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/feed-identity", () => ({
  mintNewPropertyFeedIdentity: mocks.mintNewPropertyFeedIdentity,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { create: mocks.propertyCreate },
    reservation: { create: mocks.reservationCreate },
  },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 4, username: "owner", role: "user" });
  mocks.mintNewPropertyFeedIdentity.mockResolvedValue({
    feedToken: "secure-sample-token",
    feedSlug: "sample-apartment-01234567",
  });
  mocks.propertyCreate.mockResolvedValue({ id: 61, name: "Sample Apartment" });
  mocks.reservationCreate.mockResolvedValue({});
});

describe("POST /api/properties/sample secure feed defaults", () => {
  it("creates the sample property with a protected feed identity", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.propertyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feedToken: "secure-sample-token",
        feedSlug: "sample-apartment-01234567",
      }),
    });
  });
});
