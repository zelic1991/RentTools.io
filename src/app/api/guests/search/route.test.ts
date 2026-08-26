import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  guestFindMany: vi.fn(),
  listManageablePropertyIds: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  listManageablePropertyIds: mocks.listManageablePropertyIds,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { guest: { findMany: mocks.guestFindMany } },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 1, username: "owner", role: "user" });
  mocks.listManageablePropertyIds.mockResolvedValue([11]);
  mocks.guestFindMany.mockResolvedValue([{
    id: 91,
    fullName: "Owner Guest",
    country: "HR",
    passportNumber: "P123",
    reservationId: 71,
    reservation: {
      name: "Owner Guest",
      checkIn: new Date("2027-05-20T00:00:00.000Z"),
      checkOut: new Date("2027-05-22T00:00:00.000Z"),
      propertyId: 11,
      property: { name: "Apartment A" },
    },
  }]);
});

describe("GET /api/guests/search authority", () => {
  it("denies cleaners before resolving properties or querying guest PII", async () => {
    mocks.getSession.mockResolvedValue({ userId: 9, username: "cleaner", role: "cleaner" });

    const response = await GET(
      new NextRequest("http://localhost/api/guests/search?q=guest"),
    );

    expect(response.status).toBe(403);
    expect(mocks.listManageablePropertyIds).not.toHaveBeenCalled();
    expect(mocks.guestFindMany).not.toHaveBeenCalled();
  });

  it("preserves owner/manager search while restricting the query to manageable properties", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/guests/search?q=guest"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{
        guestId: 91,
        fullName: "Owner Guest",
        passportNumber: "P123",
        propertyId: 11,
      }],
    });
    expect(mocks.guestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        reservation: { property: { id: { in: [11] } } },
      }),
    }));
    expect(JSON.stringify(mocks.guestFindMany.mock.calls[0][0])).not.toContain("21");
  });
});
