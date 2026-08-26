import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchIcalText: vi.fn(),
  findMany: vi.fn(),
  requireSuperadmin: vi.fn(),
}));

vi.mock("@/lib/ical-fetch", () => ({ fetchIcalText: mocks.fetchIcalText }));
vi.mock("@/lib/auth", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/lib/prisma", () => ({
  prisma: { property: { findMany: mocks.findMany } },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSuperadmin.mockResolvedValue({ session: { userId: 1 } });
  mocks.findMany.mockResolvedValue([{
    id: 7,
    name: "Owner-controlled property",
    calendarLinks: [{
      platform: "airbnb",
      icalExportUrl: "https://owner.example/redirect.ics",
    }],
  }]);
});

describe("calendar health transport", () => {
  it("uses the hardened iCal transport for owner-controlled feed URLs", async () => {
    mocks.fetchIcalText.mockResolvedValue(
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n",
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.fetchIcalText).toHaveBeenCalledWith(
      "https://owner.example/redirect.ics",
      expect.objectContaining({
        timeoutMs: 15_000,
        userAgent: "RentTool-CalendarHealth/1.0",
      }),
    );
    expect(await response.json()).toEqual({
      properties: [{
        id: 7,
        name: "Owner-controlled property",
        airbnbFeed: expect.objectContaining({ status: "ok", eventCount: 0 }),
        bookingFeed: { url: "", status: "missing", eventCount: 0 },
      }],
    });
  });

  it("reports hardened transport rejection without falling back to raw fetch", async () => {
    mocks.fetchIcalText.mockRejectedValue(new Error("iCal destination is not public"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.properties[0].airbnbFeed).toEqual({
      url: "https://owner.example/redirect.ics",
      status: "error",
      eventCount: 0,
      error: "iCal destination is not public",
    });
  });
});
