import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  isPropertyOwner: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
  isPropertyOwner: mocks.isPropertyOwner,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendarLink: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

import { PATCH } from "./route";

const context = { params: Promise.resolve({ id: "9" }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 8, role: "user" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.isPropertyOwner.mockResolvedValue(false);
  mocks.findUnique.mockResolvedValue({ id: 9, propertyId: 12, platform: "airbnb" });
  mocks.update.mockResolvedValue({
    id: 9,
    propertyId: 12,
    platform: "airbnb",
    icalExportUrl: "https://provider.test/private-token.ics",
    bufferBefore: 1,
    bufferAfter: 0,
  });
});

describe("PATCH /api/calendar/links/[id] — credential projection", () => {
  it("does not reveal the stored provider URL to an assigned manager", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/calendar/links/9", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bufferBefore: 1 }),
    }), context);

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("icalExportUrl");
    expect(JSON.stringify(body)).not.toContain("private-token");
  });

  it("does not reveal the stored provider URL during support impersonation", async () => {
    mocks.getSession.mockResolvedValue({ userId: 7, role: "user", impersonatorId: 99 });
    mocks.isPropertyOwner.mockResolvedValue(true);

    const response = await PATCH(new NextRequest("http://localhost/api/calendar/links/9", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bufferAfter: 0 }),
    }), context);

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("icalExportUrl");
  });

  it("returns the provider URL to the non-impersonated property owner", async () => {
    mocks.getSession.mockResolvedValue({ userId: 7, role: "user" });
    mocks.isPropertyOwner.mockResolvedValue(true);

    const response = await PATCH(new NextRequest("http://localhost/api/calendar/links/9", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bufferAfter: 0 }),
    }), context);

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.icalExportUrl).toBe("https://provider.test/private-token.ics");
  });
});
