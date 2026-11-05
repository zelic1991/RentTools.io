import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
  canReadProperty: mocks.canManageProperty,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { dateOverride: { deleteMany: mocks.deleteMany, updateMany: mocks.updateMany } },
}));

import { DELETE, PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, role: "user" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.deleteMany.mockResolvedValue({ count: 10 });
  mocks.updateMany.mockResolvedValue({ count: 10 });
});

function del(query: string) {
  return DELETE(new NextRequest(`http://localhost/api/date-overrides?${query}`, { method: "DELETE" }));
}

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/date-overrides", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("DELETE /api/date-overrides range", () => {
  it("lifts every block of the run in one call", async () => {
    const res = await del("propertyId=1&from=2027-06-14&to=2027-06-24");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ action: "removed", count: 10 });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { propertyId: 1, type: "closed", date: { gte: "2027-06-14", lt: "2027-06-24" } },
    });
  });

  it("rejects a reversed or malformed range", async () => {
    expect((await del("propertyId=1&from=2027-06-24&to=2027-06-14")).status).toBe(400);
    expect((await del("propertyId=1&from=14.06.2027&to=2027-06-24")).status).toBe(400);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses someone who may not manage the property", async () => {
    mocks.canManageProperty.mockResolvedValue(false);
    expect((await del("propertyId=1&from=2027-06-14&to=2027-06-24")).status).toBe(404);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/date-overrides hold", () => {
  it("sets the last held day on the blocked days of the range", async () => {
    const res = await patch({ propertyId: 1, from: "2027-06-14", to: "2027-06-24", holdUntil: "2026-11-01" });
    expect(res.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { propertyId: 1, type: "closed", date: { gte: "2027-06-14", lt: "2027-06-24" } },
      data: { holdUntil: "2026-11-01" },
    });
  });

  it("clears the hold with null", async () => {
    await patch({ propertyId: 1, from: "2027-06-14", to: "2027-06-24", holdUntil: null });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { holdUntil: null } }));
  });

  it("rejects a missing or malformed hold date", async () => {
    expect((await patch({ propertyId: 1, from: "2027-06-14", to: "2027-06-24" })).status).toBe(400);
    expect((await patch({ propertyId: 1, from: "2027-06-14", to: "2027-06-24", holdUntil: "1.11." })).status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
