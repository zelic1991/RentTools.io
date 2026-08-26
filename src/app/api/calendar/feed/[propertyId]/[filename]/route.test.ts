import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  draftFindUnique: vi.fn(),
  generateEmptyFeed: vi.fn(),
  generateFeed: vi.fn(),
  propertyFindFirst: vi.fn(),
}));

vi.mock("@/lib/feed", () => ({
  generateEmptyFeed: mocks.generateEmptyFeed,
  generateFeed: mocks.generateFeed,
  parseFeedFilename: vi.fn(() => "airbnb"),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, resetSeconds: 0 })),
  clientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingDraft: { findUnique: mocks.draftFindUnique },
    property: { findFirst: mocks.propertyFindFirst },
  },
}));

import { GET } from "./route";

const context = {
  params: Promise.resolve({ propertyId: "vir-draft", filename: "for-airbnb.ics" }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.propertyFindFirst.mockResolvedValue(null);
  mocks.draftFindUnique.mockResolvedValue({
    id: 7,
    claimedByUserId: null,
    feedToken: "draft-secret-token",
  });
  mocks.generateEmptyFeed.mockReturnValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
});

describe("pre-signup draft feed protection", () => {
  it("serves the empty feed only for the exact draft bearer token", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/calendar/feed/vir-draft/for-airbnb.ics?token=draft-secret-token"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(mocks.generateEmptyFeed).toHaveBeenCalledWith("RentTools onboarding");
  });

  it.each([
    "",
    "?token=wrong-secret-token",
  ])("rejects a missing or wrong draft token", async (query) => {
    const response = await GET(
      new NextRequest(`http://localhost/api/calendar/feed/vir-draft/for-airbnb.ics${query}`),
      context,
    );

    expect(response.status).toBe(401);
    expect(mocks.generateEmptyFeed).not.toHaveBeenCalled();
  });

  it("fails closed for a legacy null-token draft", async () => {
    mocks.draftFindUnique.mockResolvedValue({
      id: 8,
      claimedByUserId: null,
      feedToken: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/calendar/feed/vir-draft/for-airbnb.ics"),
      context,
    );

    expect(response.status).toBe(401);
    expect(mocks.generateEmptyFeed).not.toHaveBeenCalled();
  });
});

describe("Property feed protection", () => {
  it("fails closed for a legacy Property without a feed token", async () => {
    mocks.propertyFindFirst.mockResolvedValue({ id: 12, feedToken: null });

    const response = await GET(
      new NextRequest("http://localhost/api/calendar/feed/12/for-airbnb.ics"),
      { params: Promise.resolve({ propertyId: "12", filename: "for-airbnb.ics" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.generateFeed).not.toHaveBeenCalled();
  });

  it("serves a Property feed only for the exact bearer token", async () => {
    mocks.propertyFindFirst.mockResolvedValue({ id: 12, feedToken: "property-secret" });
    mocks.generateFeed.mockResolvedValue({ ical: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n" });

    const response = await GET(
      new NextRequest("http://localhost/api/calendar/feed/12/for-airbnb.ics?token=property-secret"),
      { params: Promise.resolve({ propertyId: "12", filename: "for-airbnb.ics" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.generateFeed).toHaveBeenCalledWith(12, "airbnb");
  });
});
