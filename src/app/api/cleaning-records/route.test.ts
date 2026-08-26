import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  assignmentFindUnique: vi.fn(),
  calendarEventCreate: vi.fn(),
  dateOverrideUpsert: vi.fn(),
  getPropertyAccess: vi.fn(),
  getSession: vi.fn(),
  listAccessiblePropertyIds: vi.fn(),
  recordCreate: vi.fn(),
  recordFindMany: vi.fn(),
  recordFindUnique: vi.fn(),
  recordUpdateMany: vi.fn(),
  reservationUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  getPropertyAccess: mocks.getPropertyAccess,
  listAccessiblePropertyIds: mocks.listAccessiblePropertyIds,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendarEvent: { create: mocks.calendarEventCreate },
    cleanerAssignment: { findUnique: mocks.assignmentFindUnique },
    cleaningRecord: {
      create: mocks.recordCreate,
      findMany: mocks.recordFindMany,
      findUnique: mocks.recordFindUnique,
      updateMany: mocks.recordUpdateMany,
    },
    dateOverride: { upsert: mocks.dateOverrideUpsert },
    reservation: { update: mocks.reservationUpdate },
  },
}));

import { GET, POST } from "./route";

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 71,
    propertyId: 11,
    date: "2027-05-20",
    status: "PLANNED",
    assignedCleanerId: null,
    assignedAt: null,
    startedAt: null,
    issueAt: null,
    doneAt: null,
    doneByUserId: null,
    updatedByUserId: 1,
    notes: "",
    photos: "[]",
    createdAt: new Date("2027-05-01T00:00:00.000Z"),
    updatedAt: null,
    ...overrides,
  };
}

function post(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/cleaning-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 1, username: "owner-a", role: "user" });
  mocks.getPropertyAccess.mockResolvedValue("owner");
  mocks.assignmentFindUnique.mockResolvedValue({ id: 501 });
  mocks.recordFindUnique.mockResolvedValue(null);
  mocks.recordCreate.mockImplementation(async ({ data }) => record(data));
  mocks.recordUpdateMany.mockResolvedValue({ count: 1 });
  mocks.recordFindMany.mockResolvedValue([]);
  mocks.listAccessiblePropertyIds.mockResolvedValue([11]);
});

describe("cleaning record tenant boundary", () => {
  it("returns 404 for another owner's property without touching its records", async () => {
    mocks.getPropertyAccess.mockImplementation(async (propertyId) => (
      propertyId === 11 ? "owner" : "none"
    ));

    const response = await POST(post({
      propertyId: 21,
      date: "2027-05-20",
      status: "PLANNED",
    }));

    expect(response.status).toBe(404);
    expect(mocks.recordFindUnique).not.toHaveBeenCalled();
    expect(mocks.recordCreate).not.toHaveBeenCalled();
  });

  it("requires an active same-property assignment before management assigns", async () => {
    mocks.recordFindUnique.mockResolvedValue(record());
    mocks.assignmentFindUnique.mockResolvedValue(null);

    const response = await POST(post({
      propertyId: 11,
      date: "2027-05-20",
      status: "ASSIGNED",
      assignedCleanerId: 9,
    }));

    expect(response.status).toBe(404);
    expect(mocks.assignmentFindUnique).toHaveBeenCalledWith({
      where: { cleanerId_propertyId: { cleanerId: 9, propertyId: 11 } },
      select: { id: true },
    });
    expect(mocks.recordUpdateMany).not.toHaveBeenCalled();
  });
});

describe("cleaner operational transitions", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ userId: 9, username: "cleaner", role: "cleaner" });
    mocks.getPropertyAccess.mockResolvedValue("cleaner");
  });

  it("lets the assigned active cleaner start work", async () => {
    const assigned = record({ status: "ASSIGNED", assignedCleanerId: 9 });
    const inProgress = record({
      status: "IN_PROGRESS",
      assignedCleanerId: 9,
      startedAt: new Date("2027-05-20T08:00:00.000Z"),
      updatedByUserId: 9,
    });
    mocks.recordFindUnique
      .mockResolvedValueOnce(assigned)
      .mockResolvedValueOnce(inProgress);

    const response = await POST(post({
      propertyId: 11,
      date: "2027-05-20",
      status: "IN_PROGRESS",
    }));

    expect(response.status).toBe(200);
    expect(mocks.assignmentFindUnique).toHaveBeenCalledWith({
      where: { cleanerId_propertyId: { cleanerId: 9, propertyId: 11 } },
      select: { id: true },
    });
    expect(mocks.recordUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 71, status: "ASSIGNED", assignedCleanerId: 9 },
      data: expect.objectContaining({
        status: "IN_PROGRESS",
        updatedByUserId: 9,
        startedAt: expect.any(Date),
      }),
    }));
  });

  it("fails closed after the property assignment is revoked", async () => {
    mocks.recordFindUnique.mockResolvedValue(record({
      status: "ASSIGNED",
      assignedCleanerId: 9,
    }));
    mocks.assignmentFindUnique.mockResolvedValue(null);

    const response = await POST(post({
      propertyId: 11,
      date: "2027-05-20",
      status: "IN_PROGRESS",
    }));

    expect(response.status).toBe(404);
    expect(mocks.recordUpdateMany).not.toHaveBeenCalled();
  });

  it("cannot skip directly from assigned to ready", async () => {
    mocks.recordFindUnique.mockResolvedValue(record({
      status: "ASSIGNED",
      assignedCleanerId: 9,
    }));

    const response = await POST(post({
      propertyId: 11,
      date: "2027-05-20",
      status: "done",
    }));

    expect(response.status).toBe(409);
    expect(mocks.recordUpdateMany).not.toHaveBeenCalled();
  });

  it("reads only its own assigned tasks even on an accessible property", async () => {
    const request = new NextRequest(
      "http://localhost/api/cleaning-records?propertyId=11",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.recordFindMany).toHaveBeenCalledWith({
      where: {
        propertyId: { in: [11] },
        assignedCleanerId: 9,
      },
      orderBy: { date: "asc" },
    });
  });
});

describe("cleaning workflow availability neutrality", () => {
  it("plans operational work without writing availability or reservation state", async () => {
    const response = await POST(post({
      propertyId: 11,
      date: "2027-05-20",
      status: "pending",
      notes: "same-day turnover",
    }));

    expect(response.status).toBe(200);
    expect(mocks.recordCreate).toHaveBeenCalledWith({
      data: {
        propertyId: 11,
        date: "2027-05-20",
        status: "PLANNED",
        notes: "same-day turnover",
        updatedByUserId: 1,
      },
    });
    expect(mocks.dateOverrideUpsert).not.toHaveBeenCalled();
    expect(mocks.reservationUpdate).not.toHaveBeenCalled();
    expect(mocks.calendarEventCreate).not.toHaveBeenCalled();
  });
});
