import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  propertyFindFirst: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findFirst: mocks.propertyFindFirst,
    },
  },
}));

vi.mock("@/lib/ownership", () => ({
  getPropertyAccess: vi.fn(),
}));

import { loadMobileOperations } from "@/lib/mobile-operations";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 1, role: "superadmin" });
  mocks.propertyFindFirst.mockResolvedValue(null);
  mocks.redirect.mockImplementation((destination: string) => {
    throw new Error(`redirect:${destination}`);
  });
});

describe("mobile operations routing", () => {
  it("leaves the mobile route when an authenticated user has no property", async () => {
    await expect(loadMobileOperations({ section: "start" }))
      .rejects.toThrow("redirect:/dashboard");
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
