import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isPropertyOwner: vi.fn(),
  logAudit: vi.fn(),
  mintFeedToken: vi.fn(),
  propertyFindUnique: vi.fn(),
  propertyUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/feed-identity", () => ({ mintFeedToken: mocks.mintFeedToken }));
vi.mock("@/lib/ownership", () => ({ isPropertyOwner: mocks.isPropertyOwner }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findUnique: mocks.propertyFindUnique,
      update: mocks.propertyUpdate,
    },
  },
}));

import { DELETE, GET, POST } from "./route";

const context = { params: Promise.resolve({ id: "17" }) };
const request = new NextRequest("http://localhost/api/properties/17/rotate-feed-token");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, username: "owner", role: "user" });
  mocks.isPropertyOwner.mockResolvedValue(true);
  mocks.mintFeedToken.mockReturnValue("rotated-secure-token");
  mocks.propertyFindUnique.mockResolvedValue({ feedToken: "current-secure-token" });
  mocks.propertyUpdate.mockResolvedValue({ id: 17, feedToken: "rotated-secure-token" });
});

describe("property feed token owner boundary", () => {
  it.each([GET, POST])("returns 404 to a manager", async (handler) => {
    mocks.getSession.mockResolvedValue({ userId: 8, username: "manager", role: "manager" });
    mocks.isPropertyOwner.mockResolvedValue(false);

    const response = await handler(request, context);

    expect(response.status).toBe(404);
    expect(mocks.propertyFindUnique).not.toHaveBeenCalled();
    expect(mocks.propertyUpdate).not.toHaveBeenCalled();
  });

  it.each([GET, POST])("returns 404 to an impersonated owner session", async (handler) => {
    mocks.getSession.mockResolvedValue({
      userId: 3,
      username: "owner",
      role: "user",
      impersonatorId: 99,
    });

    const response = await handler(request, context);

    expect(response.status).toBe(404);
    expect(mocks.isPropertyOwner).not.toHaveBeenCalled();
  });

  it("flags a legacy null token without exposing it to non-owners", async () => {
    mocks.propertyFindUnique.mockResolvedValue({ feedToken: null });

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      feedToken: null,
      requiresMigration: true,
    });
  });

  it("lets only the owner rotate and audits the protected replacement", async () => {
    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(mocks.propertyUpdate).toHaveBeenCalledWith({
      where: { id: 17 },
      data: { feedToken: "rotated-secure-token" },
      select: { id: true, feedToken: true },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(3, "update", "property", 17, {
      feedTokenRotated: true,
    });
  });

  it("disables clearing a token for every caller", async () => {
    const response = await DELETE();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
    expect(mocks.propertyUpdate).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});
