import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccessiblePropertyIds: vi.fn(),
  propertyFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  syncFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  listAccessiblePropertyIds: mocks.listAccessiblePropertyIds,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { findMany: mocks.propertyFindMany },
    auditLog: { findMany: mocks.auditFindMany },
    syncLog: { findMany: mocks.syncFindMany },
  },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 9, role: "cleaner" });
});

describe("GET /api/activity — cleaner isolation", () => {
  it("does not expose raw audit or sync messages to cleaners", async () => {
    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.listAccessiblePropertyIds).not.toHaveBeenCalled();
    expect(mocks.auditFindMany).not.toHaveBeenCalled();
    expect(mocks.syncFindMany).not.toHaveBeenCalled();
  });
});
