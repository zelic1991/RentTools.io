import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearSessionCookies: vi.fn(),
  getSession: vi.fn(),
  logAudit: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  clearSessionCookies: mocks.clearSessionCookies,
  getSession: mocks.getSession,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: mocks.userUpdate } },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: 12,
    username: "owner",
    role: "user",
    sessionVersion: 4,
  });
  mocks.userUpdate.mockResolvedValue({ id: 12 });
});

describe("POST /api/auth/logout-all", () => {
  it("increments the authority version and clears both browser cookies", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(mocks.clearSessionCookies).toHaveBeenCalledOnce();
    expect(mocks.logAudit).toHaveBeenCalledWith(12, "update", "user", 12, {
      sessionsRevoked: true,
      actor: "self",
    });
  });

  it("does not let an impersonated operator revoke the target's sessions", async () => {
    mocks.getSession.mockResolvedValue({
      userId: 12,
      username: "owner",
      role: "user",
      sessionVersion: 4,
      impersonatorId: 1,
    });

    const response = await POST();

    expect(response.status).toBe(403);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
