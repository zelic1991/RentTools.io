import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearImpersonatorCookie: vi.fn(),
  clearSessionCookies: vi.fn(),
  getSession: vi.fn(),
  logAudit: vi.fn(),
  readImpersonatorCookie: vi.fn(),
  setSessionCookie: vi.fn(),
  validateSessionToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  clearImpersonatorCookie: mocks.clearImpersonatorCookie,
  clearSessionCookies: mocks.clearSessionCookies,
  getSession: mocks.getSession,
  readImpersonatorCookie: mocks.readImpersonatorCookie,
  setSessionCookie: mocks.setSessionCookie,
  validateSessionToken: mocks.validateSessionToken,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: 12,
    username: "target",
    role: "user",
    sessionVersion: 4,
    impersonatorId: 1,
    impersonatorUsername: "admin",
    impersonatorSessionVersion: 7,
  });
  mocks.readImpersonatorCookie.mockResolvedValue("parked-admin-jwt");
  mocks.validateSessionToken.mockResolvedValue({
    userId: 1,
    username: "admin",
    role: "superadmin",
    sessionVersion: 7,
  });
});

describe("exit impersonation authority restore", () => {
  it("restores only the still-valid matching superadmin session", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.validateSessionToken).toHaveBeenCalledWith("parked-admin-jwt");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      "parked-admin-jwt",
      60 * 60 * 24 * 7,
    );
    expect(mocks.clearImpersonatorCookie).toHaveBeenCalledOnce();
  });

  it("clears both cookies instead of restoring a revoked admin token", async () => {
    mocks.validateSessionToken.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(410);
    expect(mocks.clearSessionCookies).toHaveBeenCalledOnce();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects a valid token belonging to a different admin", async () => {
    mocks.validateSessionToken.mockResolvedValue({
      userId: 2,
      username: "other-admin",
      role: "superadmin",
      sessionVersion: 1,
    });

    const response = await POST();

    expect(response.status).toBe(410);
    expect(mocks.clearSessionCookies).toHaveBeenCalledOnce();
  });
});
