import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPropertyAccess: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({ getPropertyAccess: mocks.getPropertyAccess }));
vi.mock("@/lib/prisma", () => ({
  prisma: { operationalReminder: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));

import { PATCH } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 7, role: "owner", impersonatorId: null });
  mocks.getPropertyAccess.mockResolvedValue("owner");
  mocks.findUnique.mockResolvedValue({ id: 41, propertyId: 1, status: "OPEN" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("PATCH /api/operational-reminders/:id", () => {
  it("marks the hold review done without deleting its audit history", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/operational-reminders/41", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      }),
      { params: Promise.resolve({ id: "41" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 41, status: "OPEN" },
      data: expect.objectContaining({
        status: "DONE",
        completedByUserId: 7,
      }),
    }));
    expect(mocks.logAudit).toHaveBeenCalledWith(
      7,
      "update",
      "operationalReminder",
      41,
      expect.objectContaining({ status: "DONE" }),
    );
  });

  it("does not let a cleaner complete the owner's reminder", async () => {
    mocks.getSession.mockResolvedValue({ userId: 12, role: "cleaner" });
    const response = await PATCH(
      new NextRequest("http://localhost/api/operational-reminders/41", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      }),
      { params: Promise.resolve({ id: "41" }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
