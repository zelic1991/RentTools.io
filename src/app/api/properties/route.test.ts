import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  propertyCount: vi.fn(),
  propertyCreate: vi.fn(),
  propertyFindMany: vi.fn(),
  mintNewPropertyFeedIdentity: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/feed-identity", () => ({
  mintNewPropertyFeedIdentity: mocks.mintNewPropertyFeedIdentity,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      count: mocks.propertyCount,
      create: mocks.propertyCreate,
      findMany: mocks.propertyFindMany,
    },
  },
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 9, username: "cleaner", role: "cleaner" });
  mocks.propertyCount.mockResolvedValue(1);
  mocks.mintNewPropertyFeedIdentity.mockResolvedValue({
    feedToken: "secure-feed-token",
    feedSlug: "apartment-a-0123456789ab",
  });
  mocks.propertyFindMany.mockResolvedValue([{
    id: 11,
    name: "Apartment A",
    minNights: 1,
    checkInTime: "14:00",
    checkOutTime: "10:00",
    bookingWindow: 365,
    cleaningEnabled: true,
    reservations: [{
      id: 71,
      propertyId: 11,
      platform: "airbnb",
      checkIn: new Date("2027-05-20T14:00:00.000Z"),
      checkOut: new Date("2027-05-22T10:00:00.000Z"),
    }],
  }]);
});

describe("GET /api/properties cleaner projection", () => {
  it("returns only assigned operational metadata and pseudonymized reservations", async () => {
    const response = await GET(new NextRequest("http://localhost/api/properties"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([{
      id: 11,
      name: "Apartment A",
      minNights: 1,
      checkInTime: "14:00",
      checkOutTime: "10:00",
      bookingWindow: 365,
      cleaningEnabled: true,
      reservations: [{
        id: 71,
        propertyId: 11,
        platform: "airbnb",
        checkIn: "2027-05-20T14:00:00.000Z",
        checkOut: "2027-05-22T10:00:00.000Z",
        name: "Guest",
      }],
    }]);
    expect(mocks.propertyFindMany).toHaveBeenCalledWith({
      where: { cleanerAssignments: { some: { cleanerId: 9 } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        minNights: true,
        checkInTime: true,
        checkOutTime: true,
        bookingWindow: true,
        cleaningEnabled: true,
        reservations: {
          orderBy: { checkIn: "asc" },
          select: {
            id: true,
            propertyId: true,
            platform: true,
            checkIn: true,
            checkOut: true,
          },
        },
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("feedToken");
    expect(serialized).not.toContain("feedSlug");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("tgGroupUrl");
    expect(serialized).not.toContain("waGroupUrl");
  });

  it("uses the same safe projection for paginated cleaner reads", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/properties?page=1&limit=20"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].reservations[0].name).toBe("Guest");
    expect(mocks.propertyCount).toHaveBeenCalledWith({
      where: { cleanerAssignments: { some: { cleanerId: 9 } } },
    });
    expect(mocks.propertyFindMany.mock.calls[0][0]).toHaveProperty("select");
    expect(mocks.propertyFindMany.mock.calls[0][0]).not.toHaveProperty("include");
  });

  it("preserves the full owner/manager response path", async () => {
    const fullProperty = {
      id: 11,
      userId: 1,
      name: "Apartment A",
      feedToken: "owner-secret",
      feedSlug: "owner-feed",
      reservations: [{ id: 71, name: "Real Guest", phone: "+385" }],
    };
    mocks.getSession.mockResolvedValue({ userId: 1, username: "owner", role: "user" });
    mocks.propertyFindMany.mockResolvedValue([fullProperty]);

    const response = await GET(new NextRequest("http://localhost/api/properties"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([fullProperty]);
    expect(mocks.propertyFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: 1 },
          { managers: { some: { managerId: 1 } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        reservations: {
          orderBy: { checkIn: "asc" },
          include: { _count: { select: { guests: true } } },
        },
      },
    });
  });

  it("redacts feedToken from managed properties while preserving owned tokens", async () => {
    const ownedProperty = {
      id: 11,
      userId: 1,
      name: "Owned Apartment",
      feedToken: "owned-secret",
      feedSlug: "owned-feed",
      reservations: [],
    };
    const managedProperty = {
      id: 12,
      userId: 2,
      name: "Managed Apartment",
      feedToken: "other-owner-secret",
      feedSlug: "managed-feed",
      reservations: [],
    };
    mocks.getSession.mockResolvedValue({ userId: 1, username: "owner-manager", role: "user" });
    mocks.propertyFindMany.mockResolvedValue([ownedProperty, managedProperty]);

    const response = await GET(new NextRequest("http://localhost/api/properties"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body[0].feedToken).toBe("owned-secret");
    expect(body[1]).not.toHaveProperty("feedToken");
    expect(body[1].feedSlug).toBe("managed-feed");
    expect(JSON.stringify(body)).not.toContain("other-owner-secret");
  });

  it("redacts owned feedToken during support impersonation", async () => {
    mocks.getSession.mockResolvedValue({
      userId: 1,
      username: "owner",
      role: "user",
      impersonatorId: 99,
    });
    mocks.propertyFindMany.mockResolvedValue([{
      id: 11,
      userId: 1,
      name: "Owned Apartment",
      feedToken: "owned-secret",
      feedSlug: "owned-feed",
      reservations: [],
    }]);

    const response = await GET(new NextRequest("http://localhost/api/properties"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body[0]).not.toHaveProperty("feedToken");
    expect(body[0].feedSlug).toBe("owned-feed");
    expect(JSON.stringify(body)).not.toContain("owned-secret");
  });

  it("applies the same manager redaction to paginated responses", async () => {
    mocks.getSession.mockResolvedValue({ userId: 1, username: "manager", role: "user" });
    mocks.propertyFindMany.mockResolvedValue([{
      id: 12,
      userId: 2,
      name: "Managed Apartment",
      feedToken: "other-owner-secret",
      feedSlug: "managed-feed",
      reservations: [],
    }]);

    const response = await GET(
      new NextRequest("http://localhost/api/properties?page=1&limit=20"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0]).not.toHaveProperty("feedToken");
    expect(JSON.stringify(body)).not.toContain("other-owner-secret");
  });
});

describe("POST /api/properties role boundary", () => {
  it("does not let a cleaner account create an owned property", async () => {
    const response = await POST(new NextRequest("http://localhost/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cleaner-owned bypass" }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.propertyCreate).not.toHaveBeenCalled();
    expect(mocks.mintNewPropertyFeedIdentity).not.toHaveBeenCalled();
  });

  it("persists a token and durable slug on a newly created property", async () => {
    mocks.getSession.mockResolvedValue({ userId: 1, username: "owner", role: "user" });
    mocks.propertyCreate.mockResolvedValue({ id: 23, name: "Apartment A" });

    const response = await POST(new NextRequest("http://localhost/api/properties", {
      method: "POST",
      body: JSON.stringify({ name: "  Apartment A  " }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.mintNewPropertyFeedIdentity).toHaveBeenCalledWith("Apartment A");
    expect(mocks.propertyCreate).toHaveBeenCalledWith({
      data: {
        name: "Apartment A",
        userId: 1,
        minNights: 1,
        feedToken: "secure-feed-token",
        feedSlug: "apartment-a-0123456789ab",
      },
    });
  });
});
