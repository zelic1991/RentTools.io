import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
  requireSuperadmin: vi.fn(),
  userUpdateMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { updateMany: mocks.userUpdateMany } },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSuperadmin.mockResolvedValue({
    session: { userId: 1, username: "admin", role: "superadmin", sessionVersion: 7 },
    response: null,
  });
  mocks.userUpdateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/admin/users/:id/revoke-sessions", () => {
  it("revokes the target without changing any account data", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "12" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(1, "update", "user", 12, {
      sessionsRevoked: true,
      actor: "superadmin",
    });
  });

  it("fails closed when the target does not exist", async () => {
    mocks.userUpdateMany.mockResolvedValue({ count: 0 });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "404" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("requires self-service logout-all for the current admin", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
  });
});
