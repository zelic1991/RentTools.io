import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  isPropertyOwner: vi.fn(),
  propertyUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
  isPropertyOwner: mocks.isPropertyOwner,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { update: mocks.propertyUpdate },
  },
}));

import { PATCH } from "./route";

const context = { params: Promise.resolve({ id: "17" }) };

function request() {
  return new NextRequest("http://localhost/api/properties/17", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Updated Apartment" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, username: "owner", role: "user" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.isPropertyOwner.mockResolvedValue(true);
  mocks.propertyUpdate.mockResolvedValue({
    id: 17,
    userId: 3,
    name: "Updated Apartment",
    feedToken: "durable-feed-secret",
  });
});

describe("PATCH /api/properties/[id] secret projection", () => {
  it("preserves feedToken only for the non-impersonated property owner", async () => {
    const response = await PATCH(request(), context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feedToken).toBe("durable-feed-secret");
    expect(mocks.isPropertyOwner).toHaveBeenCalledWith(17, 3);
  });

  it("redacts feedToken from a manager response", async () => {
    mocks.getSession.mockResolvedValue({ userId: 8, username: "manager", role: "user" });
    mocks.isPropertyOwner.mockResolvedValue(false);

    const response = await PATCH(request(), context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty("feedToken");
    expect(JSON.stringify(body)).not.toContain("durable-feed-secret");
  });

  it("redacts feedToken while support impersonates the owner", async () => {
    mocks.getSession.mockResolvedValue({
      userId: 3,
      username: "owner",
      role: "user",
      impersonatorId: 99,
    });

    const response = await PATCH(request(), context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty("feedToken");
    expect(mocks.isPropertyOwner).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("durable-feed-secret");
  });
});
