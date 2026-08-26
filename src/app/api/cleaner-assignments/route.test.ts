import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPropertyAccess: vi.fn(),
  isPropertyOwner: vi.fn(),
  propertyFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  cleanerFindUnique: vi.fn(),
  cleanerFindFirst: vi.fn(),
  cleanerCreate: vi.fn(),
  assignmentFindUnique: vi.fn(),
  assignmentFindMany: vi.fn(),
  assignmentCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/ownership", () => ({
  getPropertyAccess: mocks.getPropertyAccess,
  isPropertyOwner: mocks.isPropertyOwner,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { findUnique: mocks.propertyFindUnique },
    user: { findUnique: mocks.userFindUnique },
    cleaner: {
      findUnique: mocks.cleanerFindUnique,
      findFirst: mocks.cleanerFindFirst,
      create: mocks.cleanerCreate,
    },
    cleanerAssignment: {
      findUnique: mocks.assignmentFindUnique,
      findMany: mocks.assignmentFindMany,
      create: mocks.assignmentCreate,
    },
  },
}));

import { GET, POST } from "./route";

function postLegacy(propertyId: number) {
  return new NextRequest("http://localhost/api/cleaner-assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, username: "shared-cleaner" }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 1, role: "user" });
  mocks.isPropertyOwner.mockResolvedValue(true);
  mocks.getPropertyAccess.mockResolvedValue("owner");
  mocks.userFindUnique.mockResolvedValue({
    id: 3,
    role: "cleaner",
    username: "shared-cleaner",
  });
  mocks.assignmentFindUnique.mockResolvedValue(null);
  mocks.cleanerFindFirst.mockImplementation(async (query) => {
    if (query.where.ownerUserId === 1) {
      return { id: 101, name: "Shared Cleaner A", phone: "+385-a" };
    }
    return null;
  });
  mocks.cleanerCreate.mockImplementation(async ({ data }) => ({
    id: 102,
    name: data.name,
    phone: data.phone,
  }));
  mocks.assignmentCreate.mockImplementation(async ({ data }) => ({
    id: data.propertyId + 1000,
    ...data,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  }));
});

describe("cleaner assignment owner isolation", () => {
  it("uses separate owner-scoped profiles when one legacy cleaner serves two owners", async () => {
    const ownerAResponse = await POST(postLegacy(11));
    expect(ownerAResponse.status).toBe(200);
    await expect(ownerAResponse.json()).resolves.toMatchObject({
      propertyId: 11,
      cleanerId: 3,
      cleanerProfileId: 101,
      cleanerName: "Shared Cleaner A",
    });

    mocks.getSession.mockResolvedValue({ userId: 2, role: "user" });
    const ownerBResponse = await POST(postLegacy(21));
    expect(ownerBResponse.status).toBe(200);
    await expect(ownerBResponse.json()).resolves.toMatchObject({
      propertyId: 21,
      cleanerId: 3,
      cleanerProfileId: 102,
      cleanerName: "shared-cleaner",
    });

    expect(mocks.assignmentCreate).toHaveBeenNthCalledWith(1, {
      data: {
        cleanerId: 3,
        cleanerProfileId: 101,
        propertyId: 11,
        priority: 0,
      },
    });
    expect(mocks.assignmentCreate).toHaveBeenNthCalledWith(2, {
      data: {
        cleanerId: 3,
        cleanerProfileId: 102,
        propertyId: 21,
        priority: 0,
      },
    });
    expect(mocks.cleanerCreate).toHaveBeenCalledOnce();
    expect(mocks.cleanerCreate).toHaveBeenCalledWith({
      data: {
        ownerUserId: 2,
        name: "shared-cleaner",
        phone: null,
      },
      select: { id: true, name: true, phone: true },
    });
  });

  it("rejects assigning another owner's profile", async () => {
    mocks.getSession.mockResolvedValue({ userId: 2, role: "user" });
    mocks.cleanerFindUnique.mockResolvedValue({
      id: 101,
      ownerUserId: 1,
      name: "Shared Cleaner A",
      phone: null,
    });
    const request = new NextRequest("http://localhost/api/cleaner-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: 21, cleanerProfileId: 101 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
    expect(mocks.assignmentCreate).not.toHaveBeenCalled();
  });

  it("filters stale cross-owner profiles when reading a property's assignments", async () => {
    mocks.propertyFindUnique.mockResolvedValue({ userId: 2 });
    mocks.assignmentFindMany.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost/api/cleaner-assignments?propertyId=21"),
    );

    expect(response.status).toBe(200);
    expect(mocks.assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          propertyId: 21,
          OR: [
            { cleanerProfileId: null },
            { cleanerProfile: { ownerUserId: 2 } },
          ],
        },
      }),
    );
  });

  it("returns only the caller's minimal assignment to a cleaner", async () => {
    mocks.getSession.mockResolvedValue({ userId: 3, role: "cleaner" });
    mocks.getPropertyAccess.mockResolvedValue("cleaner");
    mocks.assignmentFindMany.mockResolvedValue([{
      id: 1001,
      propertyId: 11,
      cleanerId: 3,
      priority: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }]);

    const response = await GET(
      new NextRequest("http://localhost/api/cleaner-assignments?propertyId=11"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([{
      id: 1001,
      propertyId: 11,
      cleanerId: 3,
      priority: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    }]);
    expect(mocks.assignmentFindMany).toHaveBeenCalledWith({
      where: { propertyId: 11, cleanerId: 3 },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        propertyId: true,
        cleanerId: true,
        priority: true,
        createdAt: true,
      },
    });
    expect(mocks.propertyFindUnique).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("phone");
  });

  it("returns 404 before reading assignments for a foreign property", async () => {
    mocks.getPropertyAccess.mockResolvedValue("none");

    const response = await GET(
      new NextRequest("http://localhost/api/cleaner-assignments?propertyId=21"),
    );

    expect(response.status).toBe(404);
    expect(mocks.assignmentFindMany).not.toHaveBeenCalled();
  });
});
