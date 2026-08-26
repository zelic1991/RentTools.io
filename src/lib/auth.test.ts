import { decodeJwt, SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteCookie: vi.fn(),
  findUser: vi.fn(),
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.deleteCookie,
    get: mocks.getCookie,
    set: mocks.setCookie,
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUser } },
}));

import { clearSessionCookies, createSession, getSession } from "@/lib/auth";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-me",
);

async function staleToken(): Promise<string> {
  return new SignJWT({
    userId: 41,
    username: "old-name",
    role: "superadmin",
    sessionVersion: 3,
    impersonatorId: 7,
    impersonatorUsername: "support-admin",
    impersonatorSessionVersion: 9,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secret);
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.getCookie.mockReturnValue({ value: await staleToken() });
  mocks.findUser
    .mockResolvedValueOnce({
      username: "current-name",
      role: "user",
      suspendedAt: null,
      sessionVersion: 3,
    })
    .mockResolvedValueOnce({
      username: "current-admin",
      role: "superadmin",
      suspendedAt: null,
      sessionVersion: 9,
    });
});

describe("getSession authorization freshness", () => {
  it("uses current database role and username instead of stale JWT claims", async () => {
    const session = await getSession();

    expect(session).toEqual(expect.objectContaining({
      userId: 41,
      username: "current-name",
      role: "user",
      impersonatorId: 7,
      impersonatorUsername: "current-admin",
    }));
    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { id: 41 },
      select: { username: true, role: true, suspendedAt: true, sessionVersion: true },
    });
  });

  it("rejects a token minted before the account sessionVersion changed", async () => {
    mocks.findUser.mockReset();
    mocks.findUser.mockResolvedValue({
      username: "current-name",
      role: "user",
      suspendedAt: null,
      sessionVersion: 4,
    });

    await expect(getSession()).resolves.toBeNull();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("rent-tool-session");
    expect(mocks.deleteCookie).toHaveBeenCalledWith("rent-tool-impersonator-session");
  });

  it("rejects impersonation when the admin session was revoked", async () => {
    mocks.findUser.mockReset();
    mocks.findUser
      .mockResolvedValueOnce({
        username: "current-name",
        role: "user",
        suspendedAt: null,
        sessionVersion: 3,
      })
      .mockResolvedValueOnce({
        username: "current-admin",
        role: "superadmin",
        suspendedAt: null,
        sessionVersion: 10,
      });

    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects impersonation when the operator is no longer a superadmin", async () => {
    mocks.findUser.mockReset();
    mocks.findUser
      .mockResolvedValueOnce({
        username: "current-name",
        role: "user",
        suspendedAt: null,
        sessionVersion: 3,
      })
      .mockResolvedValueOnce({
        username: "former-admin",
        role: "user",
        suspendedAt: null,
        sessionVersion: 9,
      });

    await expect(getSession()).resolves.toBeNull();
  });
});

describe("session issuance and cookie cleanup", () => {
  it("embeds the current database sessionVersion in a newly issued JWT", async () => {
    mocks.findUser.mockReset();
    mocks.findUser.mockResolvedValue({ sessionVersion: 14, suspendedAt: null });

    const token = await createSession(41, "owner", "user");

    expect(decodeJwt(token)).toEqual(expect.objectContaining({
      userId: 41,
      sessionVersion: 14,
    }));
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "rent-tool-session",
      token,
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
  });

  it("clears the active and parked impersonator cookies together", async () => {
    await clearSessionCookies();

    expect(mocks.deleteCookie).toHaveBeenCalledWith("rent-tool-session");
    expect(mocks.deleteCookie).toHaveBeenCalledWith("rent-tool-impersonator-session");
  });
});
