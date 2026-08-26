import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccessiblePropertyIds: vi.fn(),
  userFindUnique: vi.fn(),
  syncFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  listAccessiblePropertyIds: mocks.listAccessiblePropertyIds,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    syncLog: { findMany: mocks.syncFindMany },
  },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 9, role: "cleaner" });
});

describe("GET /api/sync-alerts — cleaner isolation", () => {
  it("does not expose provider diagnostics to cleaners", async () => {
    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.listAccessiblePropertyIds).not.toHaveBeenCalled();
    expect(mocks.syncFindMany).not.toHaveBeenCalled();
  });
});
