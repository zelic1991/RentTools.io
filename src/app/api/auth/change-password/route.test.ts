import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkPasswordStrength: vi.fn(),
  clearSessionCookies: vi.fn(),
  getSession: vi.fn(),
  hashPassword: vi.fn(),
  logAudit: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  clearSessionCookies: mocks.clearSessionCookies,
  getSession: mocks.getSession,
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/security/password-strength", () => ({
  checkPasswordStrength: mocks.checkPasswordStrength,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate } },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: 12,
    username: "owner",
    role: "user",
    sessionVersion: 3,
  });
  mocks.userFindUnique.mockResolvedValue({
    id: 12,
    username: "owner",
    password: "old-hash",
    hasPassword: true,
  });
  mocks.checkPasswordStrength.mockReturnValue({ ok: true });
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.hashPassword.mockResolvedValue("new-hash");
  mocks.userUpdate.mockResolvedValue({ id: 12 });
});

describe("password change session revocation", () => {
  it("changes the password, increments sessionVersion and logs this browser out", async () => {
    const request = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: "old", newPassword: "new-strong-password" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        password: "new-hash",
        hasPassword: true,
        sessionVersion: { increment: 1 },
      },
    });
    expect(mocks.clearSessionCookies).toHaveBeenCalledOnce();
  });
});
