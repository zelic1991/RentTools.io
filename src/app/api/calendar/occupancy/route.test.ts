import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canReadProperty: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({ canReadProperty: mocks.canReadProperty }));
vi.mock("@/lib/prisma", () => ({
  prisma: { calendarEvent: { findMany: mocks.findMany } },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 12, role: "cleaner" });
  mocks.canReadProperty.mockResolvedValue(true);
  mocks.findMany.mockResolvedValue([{
    id: 8,
    platform: "booking",
    startDate: "2027-07-18",
    endDate: "2027-08-06",
  }]);
});

describe("GET /api/calendar/occupancy", () => {
  it("gives an assigned cleaner redacted occupancy without sync logs or guest names", async () => {
    const response = await GET(new NextRequest("http://localhost/api/calendar/occupancy?propertyId=1"));
    expect(response.status).toBe(200);
    expect(mocks.canReadProperty).toHaveBeenCalledWith(1, 12, "cleaner");
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { propertyId: 1 },
      select: { id: true, platform: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    });
    expect(await response.json()).toEqual({
      events: [{
        id: 8,
        platform: "booking",
        startDate: "2027-07-18",
        endDate: "2027-08-06",
        summary: "Guest",
      }],
    });
  });

  it("fails closed for an unassigned property", async () => {
    mocks.canReadProperty.mockResolvedValue(false);
    const response = await GET(new NextRequest("http://localhost/api/calendar/occupancy?propertyId=99"));
    expect(response.status).toBe(404);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
