import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  canReadProperty: vi.fn(),
  listAccessiblePropertyIds: vi.fn(),
  listManageablePropertyIds: vi.fn(),
  syncAllCalendars: vi.fn(),
  syncLogFindMany: vi.fn(),
  calendarEventFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
  canReadProperty: mocks.canReadProperty,
  listAccessiblePropertyIds: mocks.listAccessiblePropertyIds,
  listManageablePropertyIds: mocks.listManageablePropertyIds,
}));
vi.mock("@/lib/calendar-sync", () => ({ syncAllCalendars: mocks.syncAllCalendars }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncLog: { findMany: mocks.syncLogFindMany },
    calendarEvent: { findMany: mocks.calendarEventFindMany },
  },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 9, role: "cleaner" });
  mocks.canManageProperty.mockResolvedValue(false);
  mocks.listManageablePropertyIds.mockResolvedValue([]);
});

describe("POST /api/calendar/sync — write authorization", () => {
  it("does not let a cleaner sync an assigned read-only property", async () => {
    const request = new NextRequest("http://localhost/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: 12 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    expect(mocks.canManageProperty).toHaveBeenCalledWith(12, 9, "cleaner");
    expect(mocks.syncAllCalendars).not.toHaveBeenCalled();
  });

  it("does not let a read-only caller trigger the all-properties write path", async () => {
    const request = new NextRequest("http://localhost/api/calendar/sync", { method: "POST" });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.listManageablePropertyIds).toHaveBeenCalledWith(9);
    expect(mocks.syncAllCalendars).not.toHaveBeenCalled();
  });
});
