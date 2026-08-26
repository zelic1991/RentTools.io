import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  logAudit: vi.fn(),
  requireSuperadmin: vi.fn(),
  userCreate: vi.fn(),
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: mocks.hashPassword,
  requireSuperadmin: mocks.requireSuperadmin,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: mocks.userCreate,
      findMany: mocks.userFindMany,
      findUnique: mocks.userFindUnique,
    },
  },
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireSuperadmin.mockResolvedValue({
    session: { userId: 99, username: "admin", role: "superadmin" },
    response: null,
  });
  mocks.userFindMany.mockResolvedValue([]);
});

describe("GET /api/users role boundary", () => {
  it.each(["owner", "manager", "cleaner"])(
    "returns 403 for %s without enumerating users",
    async () => {
      mocks.requireSuperadmin.mockResolvedValue({
        session: null,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      });

      const response = await GET(new NextRequest("http://localhost/api/users"));

      expect(response.status).toBe(403);
      expect(mocks.userFindMany).not.toHaveBeenCalled();
    },
  );

  it("preserves filtered enumeration for superadmin UI", async () => {
    const rows = [{
      id: 3,
      username: "cleaner-a",
      role: "cleaner",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }];
    mocks.userFindMany.mockResolvedValue(rows);

    const response = await GET(
      new NextRequest("http://localhost/api/users?role=cleaner"),
    );

    expect(response.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { role: "cleaner" },
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("POST /api/users mutation boundary", () => {
  it("rejects a non-superadmin before hashing or creating", async () => {
    mocks.requireSuperadmin.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const request = new NextRequest("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "new-user", password: "Strong-passphrase-123!" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
