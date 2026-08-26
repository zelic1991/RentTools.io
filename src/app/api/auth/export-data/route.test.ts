import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userFindUnique: vi.fn(),
  propertyFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    property: { findMany: mocks.propertyFindMany },
    auditLog: { findMany: vi.fn() },
    extractionLog: { findMany: vi.fn() },
    propertyManager: { findMany: vi.fn() },
    propertyManagerInvite: { findMany: vi.fn() },
  },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: 7,
    role: "user",
    impersonatorId: 99,
  });
});

describe("GET /api/auth/export-data — impersonation boundary", () => {
  it("does not create an owner-data export during support impersonation", async () => {
    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.propertyFindMany).not.toHaveBeenCalled();
  });
});
