import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  listAccessiblePropertyIds: vi.fn(),
  logAudit: vi.fn(),
  reservationFindFirst: vi.fn(),
  reservationFindMany: vi.fn(),
  reservationCreate: vi.fn(),
  calendarEventFindFirst: vi.fn(),
  dateOverrideDeleteMany: vi.fn(),
  propertyFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
  listAccessiblePropertyIds: mocks.listAccessiblePropertyIds,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findFirst: mocks.reservationFindFirst,
      findMany: mocks.reservationFindMany,
      create: mocks.reservationCreate,
    },
    calendarEvent: {
      findFirst: mocks.calendarEventFindFirst,
    },
    dateOverride: {
      deleteMany: mocks.dateOverrideDeleteMany,
    },
    property: {
      findUnique: mocks.propertyFindUnique,
    },
  },
}));

import { GET, POST } from "./route";
import {
  addCalendarDays,
  getOwnerCalendarWindow,
} from "@/lib/owner-calendar-window";

const propertyId = 12;
const sourceUid = "shared-source-uid";

function postRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Joanne",
      checkIn: "2026-08-19",
      checkOut: "2026-08-23",
      platform: "airbnb",
      propertyId,
      ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-25T10:00:00.000Z"));
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, role: "user" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.reservationFindFirst.mockResolvedValue(null);
  mocks.reservationFindMany.mockResolvedValue([]);
  mocks.calendarEventFindFirst.mockResolvedValue(null);
  mocks.reservationCreate.mockImplementation(async ({ data }) => ({
    id: 77,
    ...data,
  }));
  mocks.dateOverrideDeleteMany.mockResolvedValue({ count: 0 });
  mocks.propertyFindUnique.mockResolvedValue({ bookingWindow: 365 });
  mocks.logAudit.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/reservations — owner calendar window", () => {
  it("rejects writes during support impersonation", async () => {
    mocks.getSession.mockResolvedValue({
      userId: 3,
      role: "user",
      impersonatorId: 99,
    });

    const response = await POST(postRequest());

    expect(response.status).toBe(403);
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("accepts the final occupiable day with checkout on the following day", async () => {
    const window = getOwnerCalendarWindow({ bookingWindowDays: 365 });
    const response = await POST(postRequest({
      checkIn: window.visibleUntil,
      checkOut: window.checkoutUntil,
      platform: "direct",
    }));

    expect(response.status).toBe(200);
    expect(mocks.reservationCreate).toHaveBeenCalled();
  });

  it("rejects the first occupancy day beyond the canonical window", async () => {
    const window = getOwnerCalendarWindow({ bookingWindowDays: 365 });
    const firstOutside = addCalendarDays(window.visibleUntil, 1);
    const response = await POST(postRequest({
      checkIn: firstOutside,
      checkOut: addCalendarDays(firstOutside, 1),
      platform: "direct",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Reservation dates are outside the owner calendar window",
    });
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/reservations — linked calendar source", () => {
  it("normalizes and excludes only the exact property/platform/UID source", async () => {
    mocks.calendarEventFindFirst
      .mockResolvedValueOnce({
        id: 41,
        startDate: "2026-08-19",
        endDate: "2026-08-23",
      })
      .mockResolvedValueOnce(null);

    const response = await POST(
      postRequest({
        platform: "  Airbnb  ",
        linkedEventUid: `  ${sourceUid}  `,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.calendarEventFindFirst).toHaveBeenNthCalledWith(1, {
      where: {
        propertyId,
        platform: "airbnb",
        uid: sourceUid,
      },
      select: { id: true, startDate: true, endDate: true },
    });
    expect(mocks.calendarEventFindFirst).toHaveBeenNthCalledWith(2, {
      where: {
        propertyId,
        startDate: { lt: "2026-08-23" },
        endDate: { gt: "2026-08-19" },
        NOT: {
          platform: "airbnb",
          uid: sourceUid,
        },
      },
      select: {
        summary: true,
        platform: true,
        startDate: true,
        endDate: true,
      },
    });
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: {
        name: "Joanne",
        checkIn: new Date("2026-08-19T00:00:00.000Z"),
        checkOut: new Date("2026-08-23T00:00:00.000Z"),
        platform: "airbnb",
        linkedEventUid: sourceUid,
        linkedEventPlatform: "airbnb",
        linkedEventRole: "claim",
        propertyId,
      },
    });
  });

  it("stores an adjacent manual extension as Direct with exact source identity", async () => {
    mocks.calendarEventFindFirst
      .mockResolvedValueOnce({
        id: 41,
        startDate: "2026-08-19",
        endDate: "2026-08-23",
      })
      .mockResolvedValueOnce(null);

    const response = await POST(
      postRequest({
        checkIn: "2026-08-23",
        checkOut: "2026-08-25",
        platform: "direct",
        linkedEventPlatform: "  Airbnb  ",
        linkedEventUid: sourceUid,
        linkedEventRole: "extension",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.calendarEventFindFirst).toHaveBeenNthCalledWith(1, {
      where: {
        propertyId,
        platform: "airbnb",
        uid: sourceUid,
      },
      select: { id: true, startDate: true, endDate: true },
    });
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: {
        name: "Joanne",
        checkIn: new Date("2026-08-23T00:00:00.000Z"),
        checkOut: new Date("2026-08-25T00:00:00.000Z"),
        platform: "direct",
        linkedEventUid: sourceUid,
        linkedEventPlatform: "airbnb",
        linkedEventRole: "extension",
        propertyId,
      },
    });
  });

  it("safely infers Direct extension semantics for a legacy adjacent request", async () => {
    mocks.calendarEventFindFirst
      .mockResolvedValueOnce({
        id: 41,
        startDate: "2026-08-19",
        endDate: "2026-08-23",
      })
      .mockResolvedValueOnce(null);

    const response = await POST(
      postRequest({
        checkIn: "2026-08-23",
        checkOut: "2026-08-24",
        platform: "airbnb",
        linkedEventUid: sourceUid,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platform: "direct",
        linkedEventPlatform: "airbnb",
        linkedEventRole: "extension",
      }),
    });
  });

  it("accepts an after-extension adjacent to a claim/source union", async () => {
    mocks.calendarEventFindFirst
      .mockResolvedValueOnce({
        id: 41,
        startDate: "2026-08-19",
        endDate: "2026-08-23",
      })
      .mockResolvedValueOnce(null);
    mocks.reservationFindMany.mockResolvedValue([
      {
        platform: "airbnb",
        linkedEventUid: sourceUid,
        linkedEventPlatform: "airbnb",
        linkedEventRole: "claim",
        checkIn: new Date("2026-08-19T00:00:00.000Z"),
        checkOut: new Date("2026-08-25T00:00:00.000Z"),
      },
    ]);

    const response = await POST(
      postRequest({
        checkIn: "2026-08-25",
        checkOut: "2026-08-26",
        platform: "direct",
        linkedEventPlatform: "airbnb",
        linkedEventUid: sourceUid,
        linkedEventRole: "extension",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checkIn: new Date("2026-08-25T00:00:00.000Z"),
        checkOut: new Date("2026-08-26T00:00:00.000Z"),
        platform: "direct",
        linkedEventRole: "extension",
      }),
    });
  });

  it("accepts a before-extension adjacent to a legacy implicit/source union", async () => {
    mocks.calendarEventFindFirst
      .mockResolvedValueOnce({
        id: 41,
        startDate: "2026-08-19",
        endDate: "2026-08-23",
      })
      .mockResolvedValueOnce(null);
    mocks.reservationFindMany.mockResolvedValue([
      {
        platform: "airbnb",
        linkedEventUid: null,
        linkedEventPlatform: null,
        linkedEventRole: null,
        checkIn: new Date("2026-08-17T00:00:00.000Z"),
        checkOut: new Date("2026-08-23T00:00:00.000Z"),
      },
    ]);

    const response = await POST(
      postRequest({
        checkIn: "2026-08-16",
        checkOut: "2026-08-17",
        platform: "direct",
        linkedEventPlatform: "airbnb",
        linkedEventUid: sourceUid,
        linkedEventRole: "extension",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checkIn: new Date("2026-08-16T00:00:00.000Z"),
        checkOut: new Date("2026-08-17T00:00:00.000Z"),
        platform: "direct",
        linkedEventRole: "extension",
      }),
    });
  });

  it("rejects a claimed role for dates that only abut the source", async () => {
    mocks.calendarEventFindFirst.mockResolvedValueOnce({
      id: 41,
      startDate: "2026-08-19",
      endDate: "2026-08-23",
    });

    const response = await POST(
      postRequest({
        checkIn: "2026-08-23",
        checkOut: "2026-08-24",
        linkedEventUid: sourceUid,
        linkedEventRole: "claim",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Linked booking relationship cannot be changed",
    });
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("still rejects an overlapping event with the same UID on another platform", async () => {
    mocks.calendarEventFindFirst
      .mockResolvedValueOnce({
        id: 41,
        startDate: "2026-08-19",
        endDate: "2026-08-23",
      })
      .mockResolvedValueOnce({
        summary: "Other guest",
        platform: "booking",
        startDate: "2026-08-20",
        endDate: "2026-08-22",
      });

    const response = await POST(
      postRequest({ linkedEventUid: sourceUid }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Overlapping booking from another platform",
      existing: {
        name: "Other guest",
        checkIn: "2026-08-20",
        checkOut: "2026-08-22",
        platform: "booking",
      },
    });
    expect(mocks.calendarEventFindFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { platform: "airbnb", uid: sourceUid },
        }),
      }),
    );
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("rejects a stale link when the exact source event does not exist", async () => {
    const response = await POST(
      postRequest({ linkedEventUid: sourceUid }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Linked calendar event not found",
    });
    expect(mocks.calendarEventFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("rejects a linked reservation detached from its source dates", async () => {
    mocks.calendarEventFindFirst.mockResolvedValueOnce({
      id: 41,
      startDate: "2026-08-19",
      endDate: "2026-08-23",
    });
    // Even an explicitly tagged but stale/corrupt claim cannot move the
    // effective boundary unless it remains connected to the raw source.
    mocks.reservationFindMany.mockResolvedValue([
      {
        platform: "airbnb",
        linkedEventUid: sourceUid,
        linkedEventPlatform: "airbnb",
        linkedEventRole: "claim",
        checkIn: new Date("2026-08-26T00:00:00.000Z"),
        checkOut: new Date("2026-08-30T00:00:00.000Z"),
      },
    ]);

    const response = await POST(
      postRequest({
        checkIn: "2026-08-26",
        checkOut: "2026-08-28",
        linkedEventUid: sourceUid,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Linked booking relationship cannot be changed",
    });
    expect(mocks.calendarEventFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("canonicalizes manual-create platform spellings when no source is linked", async () => {
    const response = await POST(
      postRequest({ platform: "Direct Sales" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.calendarEventFindFirst).toHaveBeenCalledTimes(1);
    const syncedWhere = mocks.calendarEventFindFirst.mock.calls[0][0].where;
    expect(syncedWhere).not.toHaveProperty("NOT");
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platform: "direct",
        linkedEventUid: null,
      }),
    });
  });

  it("canonicalizes Booking.com before writing the external identity namespace", async () => {
    const response = await POST(
      postRequest({ platform: "  Booking.com  " }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ platform: "booking" }),
    });
  });

  it("rejects a date-bound Direct key attached to another stay", async () => {
    const response = await POST(
      postRequest({
        platform: "direct",
        externalKey:
          "DIRECT:v1:p12:2026-08-20:2026-08-23:owner-chat:2026-08-25:001",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Direct externalKey does not match its property and checkout-exclusive stay",
    });
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("returns the existing reservation for a matching external-key retry", async () => {
    const existing = {
      id: 88,
      propertyId,
      name: "Original source name",
      platform: "booking",
      externalKey: "BOOKING:stable-42",
      checkIn: new Date("2026-08-19T00:00:00.000Z"),
      checkOut: new Date("2026-08-23T00:00:00.000Z"),
      linkedEventUid: null,
      linkedEventPlatform: null,
      linkedEventRole: null,
    };
    mocks.reservationFindFirst.mockResolvedValueOnce(existing);

    const response = await POST(
      postRequest({ platform: "Booking.com", externalKey: " BOOKING:stable-42 " }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: 88, platform: "booking" });
    expect(mocks.reservationFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.calendarEventFindFirst).not.toHaveBeenCalled();
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("rejects impossible calendar dates instead of normalizing them", async () => {
    const response = await POST(
      postRequest({ checkOut: "2026-02-30" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid checkOut date",
    });
    expect(mocks.reservationFindFirst).not.toHaveBeenCalled();
    expect(mocks.calendarEventFindFirst).not.toHaveBeenCalled();
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed body fields before authorization or database calls", async () => {
    const response = await POST(
      postRequest({ name: 123, propertyId: "12", platform: 99 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid reservation data",
    });
    expect(mocks.canManageProperty).not.toHaveBeenCalled();
    expect(mocks.reservationFindFirst).not.toHaveBeenCalled();
    expect(mocks.calendarEventFindFirst).not.toHaveBeenCalled();
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/reservations — cleaner finance boundary", () => {
  it("returns an explicitly minimal cleaner projection without financial or contact fields", async () => {
    mocks.getSession.mockResolvedValue({ userId: 31, role: "cleaner" });
    mocks.listAccessiblePropertyIds.mockResolvedValue([propertyId]);

    const response = await GET(
      new NextRequest(`http://localhost/api/reservations?propertyId=${propertyId}`),
    );

    expect(response.status).toBe(200);
    expect(mocks.reservationFindMany).toHaveBeenCalledWith({
      where: {
        propertyId,
        property: { id: { in: [propertyId] } },
      },
      orderBy: { checkIn: "asc" },
      select: {
        id: true,
        propertyId: true,
        platform: true,
        checkIn: true,
        checkOut: true,
      },
    });
    const query = mocks.reservationFindMany.mock.calls[0][0];
    expect(query.select).not.toHaveProperty("grossAmountCents");
    expect(query.select).not.toHaveProperty("currency");
    expect(query.select).not.toHaveProperty("phone");
  });
});

describe("POST /api/reservations — stored gross amount", () => {
  it("allows an authorized manager through the existing manageability gate", async () => {
    mocks.getSession.mockResolvedValue({ userId: 44, role: "manager" });
    mocks.canManageProperty.mockResolvedValue(true);

    const response = await POST(postRequest({ grossAmountCents: 25000 }));

    expect(response.status).toBe(200);
    expect(mocks.canManageProperty).toHaveBeenCalledWith(propertyId, 44, "manager");
    expect(mocks.reservationCreate).toHaveBeenCalled();
  });

  it("returns not found before a cleaner can write finance to a property", async () => {
    mocks.getSession.mockResolvedValue({ userId: 31, role: "cleaner" });
    mocks.canManageProperty.mockResolvedValue(false);

    const response = await POST(postRequest({ grossAmountCents: 25000 }));

    expect(response.status).toBe(404);
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("stores validated integer cents and normalized ISO currency", async () => {
    const response = await POST(postRequest({
      grossAmountCents: 12345,
      currency: " eur ",
    }));

    expect(response.status).toBe(200);
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        grossAmountCents: 12345,
        currency: "EUR",
      }),
    });
  });

  it("keeps omitted imported/manual prices unknown instead of inferring them", async () => {
    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    const data = mocks.reservationCreate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("grossAmountCents");
    expect(data).not.toHaveProperty("currency");
  });

  it.each([
    { input: { grossAmountCents: -1 }, label: "negative" },
    { input: { grossAmountCents: 1.5 }, label: "fractional" },
    { input: { grossAmountCents: Number.MAX_SAFE_INTEGER + 1 }, label: "unsafe" },
    { input: { currency: "ZZZ" }, label: "unsupported currency" },
  ])("rejects $label revenue input", async ({ input }) => {
    const response = await POST(postRequest(input));

    expect(response.status).toBe(400);
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });
});
