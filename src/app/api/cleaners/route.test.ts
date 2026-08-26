import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  cleanerFindMany: vi.fn(),
  cleanerCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cleaner: {
      findMany: mocks.cleanerFindMany,
      create: mocks.cleanerCreate,
    },
  },
}));

import { GET } from "./route";

const syntheticProfiles = [
  {
    id: 101,
    ownerUserId: 1,
    name: "Shared Cleaner A",
    phone: "+385-a",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    assignments: [
      { propertyId: 11, propertyOwnerId: 1, propertyName: "Owner A House", priority: 0 },
      // Simulate a stale first-assignment backfill link. The API query must
      // still prevent Owner A from seeing Owner B's property.
      { propertyId: 21, propertyOwnerId: 2, propertyName: "Owner B House", priority: 0 },
    ],
  },
  {
    id: 102,
    ownerUserId: 2,
    name: "Shared Cleaner B",
    phone: "+385-b",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    assignments: [
      { propertyId: 21, propertyOwnerId: 2, propertyName: "Owner B House", priority: 0 },
    ],
  },
];

function requestWithAssignments() {
  return new NextRequest("http://localhost/api/cleaners?withAssignments=1");
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 1, role: "user" });
  mocks.cleanerFindMany.mockImplementation(async (query) => {
    const ownerUserId = query.where.ownerUserId as number;
    const assignmentOwnerId = query.select.assignments.where.property.userId as number;
    return syntheticProfiles
      .filter((profile) => profile.ownerUserId === ownerUserId)
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        createdAt: profile.createdAt,
        assignments: profile.assignments
          .filter((assignment) => assignment.propertyOwnerId === assignmentOwnerId)
          .map((assignment) => ({
            propertyId: assignment.propertyId,
            priority: assignment.priority,
            property: {
              id: assignment.propertyId,
              name: assignment.propertyName,
            },
          })),
      }));
  });
});

describe("GET /api/cleaners owner isolation", () => {
  it("does not expose another owner's properties when one legacy cleaner serves both", async () => {
    const ownerAResponse = await GET(requestWithAssignments());
    expect(ownerAResponse.status).toBe(200);
    await expect(ownerAResponse.json()).resolves.toEqual([
      expect.objectContaining({
        id: 101,
        assignments: [
          {
            propertyId: 11,
            propertyName: "Owner A House",
            priority: 0,
          },
        ],
      }),
    ]);

    mocks.getSession.mockResolvedValue({ userId: 2, role: "user" });
    const ownerBResponse = await GET(requestWithAssignments());
    expect(ownerBResponse.status).toBe(200);
    await expect(ownerBResponse.json()).resolves.toEqual([
      expect.objectContaining({
        id: 102,
        assignments: [
          {
            propertyId: 21,
            propertyName: "Owner B House",
            priority: 0,
          },
        ],
      }),
    ]);

    expect(mocks.cleanerFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { ownerUserId: 1 },
        select: expect.objectContaining({
          assignments: expect.objectContaining({
            where: { property: { userId: 1 } },
          }),
        }),
      }),
    );
    expect(mocks.cleanerFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { ownerUserId: 2 },
        select: expect.objectContaining({
          assignments: expect.objectContaining({
            where: { property: { userId: 2 } },
          }),
        }),
      }),
    );
  });
});
