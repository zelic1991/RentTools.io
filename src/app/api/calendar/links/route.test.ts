import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  isPropertyOwner: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
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
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
      findMany: mocks.findMany,
    },
  },
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 7, role: "owner" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.isPropertyOwner.mockResolvedValue(true);
  mocks.findFirst.mockResolvedValue(null);
  mocks.create.mockImplementation(async ({ data }) => ({ id: 41, ...data }));
});

describe("POST /api/calendar/links — same-day defaults", () => {
  it("creates a new link with zero buffers when no explicit buffer is supplied", async () => {
    const response = await POST(new NextRequest("http://localhost/api/calendar/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: 12,
        platform: "Airbnb",
        icalExportUrl: "https://example.test/calendar.ics",
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId: 12,
        platform: "airbnb",
        bufferBefore: 0,
        bufferAfter: 0,
      }),
    });
  });

  it("preserves an existing link's deliberate buffers when only its URL changes", async () => {
    mocks.findFirst.mockResolvedValue({
      id: 9,
      propertyId: 12,
      platform: "airbnb",
      bufferBefore: 2,
      bufferAfter: 1,
    });
    mocks.update.mockImplementation(async ({ data }) => ({ id: 9, ...data }));

    const response = await POST(new NextRequest("http://localhost/api/calendar/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: 12,
        platform: "airbnb",
        icalExportUrl: "https://example.test/replacement.ics",
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: expect.objectContaining({ bufferBefore: 2, bufferAfter: 1 }),
    });
  });

  it("does not return a stored source URL to a manager through the update path", async () => {
    mocks.getSession.mockResolvedValue({ userId: 8, role: "user" });
    mocks.isPropertyOwner.mockResolvedValue(false);
    mocks.findFirst.mockResolvedValue({
      id: 9,
      propertyId: 12,
      platform: "airbnb",
      bufferBefore: 0,
      bufferAfter: 0,
    });
    mocks.update.mockResolvedValue({
      id: 9,
      propertyId: 12,
      platform: "airbnb",
      icalExportUrl: "https://provider.test/private-token.ics",
      bufferBefore: 0,
      bufferAfter: 0,
    });

    const response = await POST(new NextRequest("http://localhost/api/calendar/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: 12,
        platform: "airbnb",
        icalExportUrl: "https://provider.test/private-token.ics",
      }),
    }));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("icalExportUrl");
    expect(JSON.stringify(body)).not.toContain("private-token");
  });
});

describe("GET /api/calendar/links — credential projection", () => {
  it.each([
    { name: "assigned manager", session: { userId: 8, role: "user" } },
    { name: "support impersonation", session: { userId: 7, role: "user", impersonatorId: 99 } },
  ])("redacts provider URLs for $name", async ({ session }) => {
    mocks.getSession.mockResolvedValue(session);
    mocks.findMany.mockResolvedValue([{
      id: 5,
      propertyId: 12,
      platform: "airbnb",
      icalExportUrl: "https://provider.test/private-token.ics",
      bufferBefore: 0,
      bufferAfter: 0,
      property: { id: 12, name: "Apartment", userId: 7 },
    }]);

    const response = await GET(new NextRequest("http://localhost/api/calendar/links?propertyId=12"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0]).not.toHaveProperty("icalExportUrl");
    expect(body[0].property).not.toHaveProperty("userId");
    expect(JSON.stringify(body)).not.toContain("private-token");
  });

  it("returns the source URL only to the non-impersonated owner", async () => {
    mocks.findMany.mockResolvedValue([{
      id: 5,
      propertyId: 12,
      platform: "airbnb",
      icalExportUrl: "https://provider.test/private-token.ics",
      bufferBefore: 0,
      bufferAfter: 0,
      property: { id: 12, name: "Apartment", userId: 7 },
    }]);

    const response = await GET(new NextRequest("http://localhost/api/calendar/links?propertyId=12"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].icalExportUrl).toBe("https://provider.test/private-token.ics");
  });
});
