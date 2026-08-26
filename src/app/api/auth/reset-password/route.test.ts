import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkPasswordStrength: vi.fn(),
  checkRateLimit: vi.fn(),
  clearSessionCookies: vi.fn(),
  consumeEmailCode: vi.fn(),
  hashPassword: vi.fn(),
  logAudit: vi.fn(),
  normalizeEmail: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  verifyEmailCode: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  clearSessionCookies: mocks.clearSessionCookies,
  hashPassword: mocks.hashPassword,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/security/password-strength", () => ({
  checkPasswordStrength: mocks.checkPasswordStrength,
}));
vi.mock("@/lib/email-code", () => ({
  consumeEmailCode: mocks.consumeEmailCode,
  normalizeEmail: mocks.normalizeEmail,
  verifyEmailCode: mocks.verifyEmailCode,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate } },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockReturnValue({ ok: true });
  mocks.normalizeEmail.mockReturnValue("owner@example.test");
  mocks.checkPasswordStrength.mockReturnValue({ ok: true });
  mocks.verifyEmailCode.mockResolvedValue({ ok: true, id: 9, userId: 12 });
  mocks.userFindUnique.mockResolvedValue({ id: 12 });
  mocks.hashPassword.mockResolvedValue("new-hash");
  mocks.userUpdate.mockResolvedValue({ id: 12 });
});

describe("password reset session revocation", () => {
  it("increments sessionVersion before consuming the reset code", async () => {
    const request = new NextRequest("http://localhost/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email: "owner@example.test",
        code: "123456",
        newPassword: "new-strong-password",
      }),
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
    expect(mocks.consumeEmailCode).toHaveBeenCalledWith(9);
    expect(mocks.clearSessionCookies).toHaveBeenCalledOnce();
  });
});
