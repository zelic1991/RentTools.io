import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
  requireSuperadmin: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

import { DELETE, POST } from "./route";

const context = { params: Promise.resolve({ id: "12" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSuperadmin.mockResolvedValue({
    session: { userId: 1, username: "admin", role: "superadmin", sessionVersion: 2 },
    response: null,
  });
  mocks.userFindUnique.mockResolvedValue({ id: 12, role: "user" });
  mocks.userUpdate.mockResolvedValue({ id: 12 });
});

describe("account suspension session revocation", () => {
  it("increments sessionVersion when suspending", async () => {
    const response = await POST(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        suspendedAt: expect.any(Date),
        sessionVersion: { increment: 1 },
      },
    });
  });

  it("does not decrement or reset sessionVersion when unsuspending", async () => {
    const response = await DELETE(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { suspendedAt: null },
    });
  });
});
