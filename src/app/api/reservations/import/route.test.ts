import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  listAccessiblePropertyIds: vi.fn(),
  logAudit: vi.fn(),
  reservationFindFirst: vi.fn(),
  reservationCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
  listAccessiblePropertyIds: mocks.listAccessiblePropertyIds,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findFirst: mocks.reservationFindFirst,
      create: mocks.reservationCreate,
    },
  },
}));

import { POST } from "./route";

const propertyId = 12;
const csv = [
  "propertyId,name,platform,checkIn,checkOut,externalKey",
  `${propertyId},Synthetic guest,Booking.com,2027-06-01,2027-06-04,BOOKING:stable-42`,
].join("\n");

function request(body = csv): NextRequest {
  return new NextRequest("http://localhost/api/reservations/import", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, role: "user" });
  mocks.listAccessiblePropertyIds.mockResolvedValue([propertyId]);
  mocks.canManageProperty.mockResolvedValue(true);
  // First lookup: external identity preflight. Second lookup: date overlap.
  mocks.reservationFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  mocks.reservationCreate.mockImplementation(async ({ data }) => ({ id: 77, ...data }));
  mocks.logAudit.mockResolvedValue(undefined);
});

describe("POST /api/reservations/import external identity", () => {
  it("canonicalizes the platform and writes an explicit external key", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { created: 1, skipped: 0, error: 0, dryRun: false },
    });
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId,
        platform: "booking",
        externalKey: "BOOKING:stable-42",
      }),
    });
  });

  it("makes a matching retry idempotent before the ordinary overlap check", async () => {
    const existing = {
      id: 41,
      propertyId,
      name: "Earlier source spelling",
      platform: "booking",
      externalKey: "BOOKING:stable-42",
      checkIn: new Date("2027-06-01T00:00:00.000Z"),
      checkOut: new Date("2027-06-04T00:00:00.000Z"),
      linkedEventUid: null,
      linkedEventPlatform: null,
      linkedEventRole: null,
    };
    mocks.reservationFindFirst.mockReset();
    mocks.reservationFindFirst.mockResolvedValueOnce(existing);

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { created: 0, skipped: 1, error: 0 },
      results: [{ status: "skipped", reservationId: 41 }],
    });
    expect(mocks.reservationFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });
});
