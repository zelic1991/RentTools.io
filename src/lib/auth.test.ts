import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteCookie: vi.fn(),
  findUser: vi.fn(),
  getCookie: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.deleteCookie,
    get: mocks.getCookie,
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUser } },
}));

import { getSession } from "@/lib/auth";

const secret = new TextEncoder().encode("fallback-secret-change-me");

async function staleToken(): Promise<string> {
  return new SignJWT({
    userId: 41,
    username: "old-name",
    role: "superadmin",
    impersonatorId: 7,
    impersonatorUsername: "support-admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secret);
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.getCookie.mockReturnValue({ value: await staleToken() });
  mocks.findUser.mockResolvedValue({
    username: "current-name",
    role: "user",
    suspendedAt: null,
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
      impersonatorUsername: "support-admin",
    }));
    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { id: 41 },
      select: { username: true, role: true, suspendedAt: true },
    });
  });
});
