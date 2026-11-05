import { describe, expect, it } from "vitest";
import {
  blockRunAround,
  mobileDayActions,
  resolveMobileDay,
  type MobileDayState,
} from "@/lib/mobile-day-actions-core";

const reservation = {
  id: 7,
  name: "Krajci",
  checkIn: "2026-09-20T00:00:00.000Z",
  checkOut: "2026-09-23T00:00:00.000Z",
  platform: "direct",
};

const empty = { reservations: [], events: [], overrides: [] };

describe("mobile day state", () => {
  it("is free on an untouched day", () => {
    expect(resolveMobileDay("2026-09-12", empty)).toEqual({ kind: "free" });
  });

  it("holds the stay on every booked night", () => {
    const input = { ...empty, reservations: [reservation] };
    expect(resolveMobileDay("2026-09-20", input).kind).toBe("reservation");
    expect(resolveMobileDay("2026-09-22", input).kind).toBe("reservation");
  });

  it("frees the checkout day for the next arrival", () => {
    // Back-to-back is allowed everywhere else in the app; the phone must
    // not be the one screen that says a checkout day is taken.
    const input = { ...empty, reservations: [reservation] };
    expect(resolveMobileDay("2026-09-23", input)).toEqual({ kind: "free" });
  });

  it("prefers the reservation over the event it was claimed from", () => {
    const state = resolveMobileDay("2026-09-20", {
      ...empty,
      reservations: [reservation],
      events: [{ platform: "airbnb", startDate: "2026-09-20", endDate: "2026-09-23" }],
    });
    expect(state).toEqual({ kind: "reservation", reservation });
  });

  it("shows an unclaimed platform stay as an event", () => {
    expect(
      resolveMobileDay("2026-09-21", {
        ...empty,
        events: [{ platform: "booking", startDate: "2026-09-20", endDate: "2026-09-23" }],
      }),
    ).toEqual({ kind: "event", platform: "booking", startDate: "2026-09-20", endDate: "2026-09-23", sourceUid: null });
  });

  it("reads both override kinds", () => {
    expect(
      resolveMobileDay("2026-09-12", { ...empty, overrides: [{ date: "2026-09-12", type: "closed" }] }),
    ).toEqual({ kind: "blocked", from: "2026-09-12", to: "2026-09-13", holdUntil: null });
    expect(
      resolveMobileDay("2026-09-12", { ...empty, overrides: [{ date: "2026-09-12", type: "open" }] }),
    ).toEqual({ kind: "forced-open" });
  });

  it("names a buffer day instead of calling it free", () => {
    // The grid paints buffer days as unavailable. A sheet that says
    // "Frei" on a struck-through day makes the calendar look broken.
    expect(
      resolveMobileDay("2026-09-12", { ...empty, bufferDates: ["2026-09-12"] }),
    ).toEqual({ kind: "buffer" });
  });

  it("shows a scheduled cleaning instead of an empty day", () => {
    // Cleaning rows are filtered out of the phone's availability data, so
    // the day looked free — and blocking it would have replaced the
    // cleaning with an override that travels to Airbnb and Booking.
    expect(
      resolveMobileDay("2026-09-13", { ...empty, cleaningDates: ["2026-09-13"] }),
    ).toEqual({ kind: "cleaning" });
  });

  it("lets an explicit override beat a computed buffer", () => {
    const buffered = { ...empty, bufferDates: ["2026-09-12"] };
    expect(
      resolveMobileDay("2026-09-12", { ...buffered, overrides: [{ date: "2026-09-12", type: "open" }] }),
    ).toEqual({ kind: "forced-open" });
    expect(
      resolveMobileDay("2026-09-12", { ...buffered, overrides: [{ date: "2026-09-12", type: "closed" }] }),
    ).toEqual({ kind: "blocked", from: "2026-09-12", to: "2026-09-13", holdUntil: null });
  });

  it("lets a stay outrank an override, so a block never hides a guest", () => {
    const state = resolveMobileDay("2026-09-21", {
      ...empty,
      reservations: [reservation],
      overrides: [{ date: "2026-09-21", type: "closed" }],
    });
    expect(state.kind).toBe("reservation");
  });
});

describe("mobile day actions", () => {
  const free: MobileDayState = { kind: "free" };
  const blocked: MobileDayState = { kind: "blocked", from: "2026-09-12", to: "2026-09-13", holdUntil: null };
  const booked: MobileDayState = { kind: "reservation", reservation };
  const event: MobileDayState = {
    kind: "event",
    platform: "airbnb",
    startDate: "2026-09-20",
    endDate: "2026-09-23",
    sourceUid: null,
  };

  it("offers booking and blocking on a free day", () => {
    expect(mobileDayActions(free, true)).toEqual(["create", "block"]);
    expect(mobileDayActions({ kind: "forced-open" }, true)).toEqual(["create", "block"]);
  });

  it("offers lifting the block first, because that is why the sheet was opened", () => {
    expect(mobileDayActions(blocked, true)).toEqual(["unblock", "hold", "create"]);
  });

  it("offers lifting the whole block when it spans several days", () => {
    const run: MobileDayState = { kind: "blocked", from: "2027-06-14", to: "2027-06-24", holdUntil: null };
    expect(mobileDayActions(run, true)).toEqual(["unblockAll", "unblock", "hold", "create"]);
  });

  it("edits and deletes an app reservation", () => {
    expect(mobileDayActions(booked, true)).toEqual(["edit", "delete"]);
  });

  it("promises nothing on a platform booking it cannot link to", () => {
    expect(mobileDayActions(event, true)).toEqual([]);
  });

  it("offers to fill in name, amount and guests on a linkable platform booking", () => {
    expect(mobileDayActions({ ...event, sourceUid: "uid-1" } as MobileDayState, true)).toEqual(["claim"]);
  });

  it("never offers to block a cleaning day", () => {
    expect(mobileDayActions({ kind: "cleaning" }, true)).toEqual(["create"]);
  });

  it("offers a booking on a buffer day, because the server takes one", () => {
    expect(mobileDayActions({ kind: "buffer" }, true)).toEqual(["create", "block"]);
  });

  it("offers nothing at all in a read-only session", () => {
    // Support impersonation is read-only; the sheet still opens and shows
    // what the day is.
    for (const state of [free, blocked, booked, event]) {
      expect(mobileDayActions(state, false)).toEqual([]);
    }
  });
});

describe("blockRunAround", () => {
  const june = Array.from({ length: 10 }, (_, i) => ({
    date: `2027-06-${String(14 + i).padStart(2, "0")}`,
    type: "closed" as const,
    holdUntil: "2026-11-01",
  }));

  it("finds the whole run from any day inside it (the 14-23 June hold)", () => {
    expect(blockRunAround("2027-06-18", june)).toEqual({ from: "2027-06-14", to: "2027-06-24", holdUntil: "2026-11-01" });
  });

  it("stops at a gap and ignores open overrides", () => {
    const rows = [
      { date: "2027-06-01", type: "closed" as const },
      { date: "2027-06-02", type: "open" as const },
      { date: "2027-06-03", type: "closed" as const },
    ];
    expect(blockRunAround("2027-06-01", rows)).toEqual({ from: "2027-06-01", to: "2027-06-02", holdUntil: null });
  });

  it("crosses a month boundary", () => {
    const rows = [
      { date: "2027-06-30", type: "closed" as const },
      { date: "2027-07-01", type: "closed" as const },
    ];
    expect(blockRunAround("2027-07-01", rows)).toEqual({ from: "2027-06-30", to: "2027-07-02", holdUntil: null });
  });
});
