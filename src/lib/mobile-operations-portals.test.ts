import { describe, expect, it } from "vitest";
import { buildMobilePortalCards } from "@/lib/mobile-operations-core";

const base = {
  events: [] as Array<{ platform: string; startDate: string; endDate: string }>,
  reservations: [] as Array<{ platform: string; checkIn: Date; checkOut: Date }>,
  today: "2027-05-01",
  feedSlug: "zelic-family-vir",
  feedToken: "protected",
};

describe("mobile portal projection", () => {
  it("shows healthy connected portals without exposing raw URLs", () => {
    const cards = buildMobilePortalCards({
      ...base,
      links: [
        { platform: "airbnb", lastFetchedAt: new Date("2027-05-01T08:00:00Z"), lastError: null },
        { platform: "booking", lastFetchedAt: new Date("2027-05-01T08:01:00Z"), lastError: null },
      ],
    });
    expect(cards.find((card) => card.id === "airbnb")).toMatchObject({
      connected: true,
      hasError: false,
      lastSuccessfulSyncAt: "2027-05-01T08:00:00.000Z",
    });
  });

  it("marks one failed feed red and does not invent its previous successful time", () => {
    const cards = buildMobilePortalCards({
      ...base,
      links: [{
        platform: "booking",
        lastFetchedAt: new Date("2027-05-01T08:01:00Z"),
        lastError: "HTTP 502 upstream_fetch_error channelId=secret",
      }],
    });
    expect(cards.find((card) => card.id === "booking")).toMatchObject({
      connected: true,
      hasError: true,
      lastSuccessfulSyncAt: null,
      lastAttemptAt: "2027-05-01T08:01:00.000Z",
      message: "Booking.com-Kalender konnte zuletzt nicht aktualisiert werden.",
    });
  });

  it("distinguishes not connected from an unknown sync time", () => {
    const cards = buildMobilePortalCards({
      ...base,
      links: [{ platform: "airbnb", lastFetchedAt: null, lastError: null }],
    });
    expect(cards.find((card) => card.id === "airbnb")).toMatchObject({
      connected: true,
      lastSuccessfulSyncAt: null,
    });
    expect(cards.find((card) => card.id === "laganini")).toMatchObject({
      connected: false,
      lastSuccessfulSyncAt: null,
    });
  });

  it("counts mixed channel events and direct reservations", () => {
    const cards = buildMobilePortalCards({
      ...base,
      links: [],
      events: [{ platform: "ubytovani", startDate: "2027-06-01", endDate: "2027-06-05" }],
      reservations: [{
        platform: "direct",
        checkIn: new Date("2027-07-01T00:00:00Z"),
        checkOut: new Date("2027-07-04T00:00:00Z"),
      }],
    });
    expect(cards.find((card) => card.id === "ubytovani")?.upcomingEvents).toBe(1);
    expect(cards.find((card) => card.id === "website")?.upcomingEvents).toBe(1);
  });

  it("aggregates every link and deduplicates an imported stay claimed locally", () => {
    const cards = buildMobilePortalCards({
      ...base,
      links: [
        { platform: "airbnb", lastFetchedAt: new Date("2027-05-01T08:00:00Z"), lastError: null },
        { platform: "airbnb-secondary", lastFetchedAt: new Date("2027-05-01T09:00:00Z"), lastError: "timeout secret" },
      ],
      events: [{ platform: "airbnb", startDate: "2027-06-01", endDate: "2027-06-05" }],
      reservations: [{
        platform: "airbnb",
        checkIn: new Date("2027-06-01T00:00:00Z"),
        checkOut: new Date("2027-06-05T00:00:00Z"),
      }],
    });
    expect(cards.find((card) => card.id === "airbnb")).toMatchObject({
      hasError: true,
      lastSuccessfulSyncAt: "2027-05-01T08:00:00.000Z",
      lastAttemptAt: "2027-05-01T09:00:00.000Z",
      upcomingEvents: 1,
    });
  });
});
