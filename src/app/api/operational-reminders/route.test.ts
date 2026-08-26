import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPropertyAccess: vi.fn(),
  listManageablePropertyIds: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  getPropertyAccess: mocks.getPropertyAccess,
  listManageablePropertyIds: mocks.listManageablePropertyIds,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { operationalReminder: { findMany: mocks.findMany, upsert: mocks.upsert } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));

import { GET, POST } from "./route";

const row = {
  id: 41,
  propertyId: 1,
  type: "PORTAL_FOLLOW_UP",
  portal: "Booking",
  status: "OPEN",
  startDate: "2027-07-18",
  endDate: "2027-08-06",
  dueAt: new Date("2026-09-05T12:00:00.000Z"),
  note: "Zeitraum vorsorglich für interessierte Gäste gehalten",
  completedAt: null,
  completedByUserId: null,
  createdAt: new Date("2026-08-26T12:00:00.000Z"),
  property: { name: "Zelic Family Vir" },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 7, role: "owner", impersonatorId: null });
  mocks.getPropertyAccess.mockResolvedValue("owner");
  mocks.listManageablePropertyIds.mockResolvedValue([1]);
  mocks.findMany.mockResolvedValue([row]);
  mocks.upsert.mockResolvedValue(row);
});

describe("GET /api/operational-reminders", () => {
  it("returns only the caller's open operational work", async () => {
    const response = await GET(new NextRequest("http://localhost/api/operational-reminders"));
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { propertyId: { in: [1] }, status: "OPEN" },
    }));
    const body = await response.json();
    expect(body.reminders).toEqual([expect.objectContaining({
      id: 41,
      status: "OPEN",
      startDate: "2027-07-18",
      endDate: "2027-08-06",
    })]);
  });

  it("never exposes external hold reminders to cleaners", async () => {
    mocks.getSession.mockResolvedValue({ userId: 12, role: "cleaner" });
    const response = await GET(new NextRequest("http://localhost/api/operational-reminders"));
    expect(await response.json()).toEqual({ reminders: [] });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/operational-reminders", () => {
  it("upserts one review task without creating calendar inventory", async () => {
    const response = await POST(new NextRequest("http://localhost/api/operational-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: 1,
        type: "PORTAL_FOLLOW_UP",
        portal: "Booking",
        startDate: "2027-07-18",
        endDate: "2027-08-06",
        dueAt: "2026-09-05T12:00:00.000Z",
        note: "Zeitraum vorsorglich für interessierte Gäste gehalten",
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: "1|PORTAL_FOLLOW_UP|booking|2027-07-18|2027-08-06" },
      create: expect.objectContaining({ status: "OPEN" }),
      update: expect.objectContaining({ status: "OPEN", completedAt: null }),
    }));
    expect(mocks.logAudit).toHaveBeenCalledWith(
      7,
      "create",
      "operationalReminder",
      41,
      expect.objectContaining({ startDate: "2027-07-18", endDate: "2027-08-06" }),
    );
  });

  it("rejects cleaner and impersonated writes", async () => {
    mocks.getSession.mockResolvedValue({ userId: 12, role: "cleaner" });
    const request = () => new NextRequest("http://localhost/api/operational-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect((await POST(request())).status).toBe(403);

    mocks.getSession.mockResolvedValue({ userId: 7, role: "owner", impersonatorId: 99 });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects impossible calendar dates before persistence", async () => {
    const response = await POST(new NextRequest("http://localhost/api/operational-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: 1,
        type: "PORTAL_FOLLOW_UP",
        portal: "Booking",
        startDate: "2027-02-30",
        endDate: "2027-03-02",
        dueAt: "2026-09-05T12:00:00.000Z",
        note: "Synthetic invalid date",
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
