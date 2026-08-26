import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listManageablePropertyIds: vi.fn(),
  reservationFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  listManageablePropertyIds: mocks.listManageablePropertyIds,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { reservation: { findMany: mocks.reservationFindMany } },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 1, username: "owner", role: "user" });
  mocks.listManageablePropertyIds.mockResolvedValue([11]);
  mocks.reservationFindMany.mockResolvedValue([{
    id: 71,
    propertyId: 11,
    property: { name: "Apartment A" },
    name: "Owner Guest",
    platform: "airbnb",
    checkIn: new Date("2027-05-20T00:00:00.000Z"),
    checkOut: new Date("2027-05-22T00:00:00.000Z"),
    createdAt: new Date("2027-04-01T00:00:00.000Z"),
    _count: { guests: 2 },
  }]);
});

describe("GET /api/reservations/export authority", () => {
  it("denies cleaners before resolving properties or reading reservations", async () => {
    mocks.getSession.mockResolvedValue({ userId: 9, username: "cleaner", role: "cleaner" });

    const response = await GET(
      new NextRequest("http://localhost/api/reservations/export"),
    );

    expect(response.status).toBe(403);
    expect(mocks.listManageablePropertyIds).not.toHaveBeenCalled();
    expect(mocks.reservationFindMany).not.toHaveBeenCalled();
  });

  it("returns 404 for another owner's explicit property", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/reservations/export?propertyId=21"),
    );

    expect(response.status).toBe(404);
    expect(mocks.reservationFindMany).not.toHaveBeenCalled();
  });

  it("preserves CSV export for owner/manager scoped properties", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/reservations/export?propertyId=11"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    const csv = await response.text();
    expect(csv).toContain("Owner Guest");
    expect(csv).toContain("Apartment A");
    expect(mocks.reservationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        property: { id: { in: [11] } },
        propertyId: 11,
      }),
    }));
  });
});
