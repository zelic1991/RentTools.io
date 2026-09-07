import { describe, expect, it } from "vitest";
import {
  normalizeCurrencyCode,
  parseGrossAmountText,
  summarizeStoredGrossAmounts,
  summarizeRevenueBreakdown,
  validateReservationRevenue,
} from "./reservation-revenue";

describe("reservation revenue validation", () => {
  it("accepts only explicit nonnegative integer cents and normalizes ISO currency", () => {
    expect(validateReservationRevenue({ grossAmountCents: 0, currency: " eur " })).toEqual({
      ok: true,
      data: { grossAmountCents: 0, currency: "EUR" },
    });
    expect(validateReservationRevenue({ grossAmountCents: 12345, currency: "USD" })).toEqual({
      ok: true,
      data: { grossAmountCents: 12345, currency: "USD" },
    });
    expect(validateReservationRevenue({ grossAmountCents: null })).toEqual({
      ok: true,
      data: { grossAmountCents: null },
    });
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid cents value %s",
    (grossAmountCents) => {
      expect(validateReservationRevenue({ grossAmountCents })).toMatchObject({ ok: false });
    },
  );

  it("rejects unsupported currency codes", () => {
    expect(normalizeCurrencyCode("ZZZ")).toBeNull();
    expect(validateReservationRevenue({ currency: "ZZZ" })).toMatchObject({ ok: false });
  });
});

describe("owner amount text parsing", () => {
  it.each([
    ["", null],
    ["123.45", 12345],
    ["12,3", 1230],
    ["0", 0],
  ])("parses %j without deriving a price", (input, cents) => {
    expect(parseGrossAmountText(input as string)).toEqual({ ok: true, cents });
  });

  it.each(["-1", "1.234", "abc", "1,2.3"])("rejects malformed amount %j", (input) => {
    expect(parseGrossAmountText(input)).toEqual({ ok: false });
  });
});

describe("stored gross amount summary", () => {
  it("sums only known stored values per currency and counts unknown rows", () => {
    const summary = summarizeStoredGrossAmounts([
      { grossAmountCents: 12345, currency: "EUR" },
      { grossAmountCents: 0, currency: "eur" },
      { grossAmountCents: 5000, currency: "USD" },
      { grossAmountCents: null, currency: "EUR" },
      { currency: "EUR" },
      { grossAmountCents: -1, currency: "EUR" },
      { grossAmountCents: 999, currency: "ZZZ" },
    ]);

    expect(summary).toEqual({
      knownCount: 3,
      unknownCount: 4,
      totalsByCurrency: [
        { currency: "EUR", amountCents: 12345 },
        { currency: "USD", amountCents: 5000 },
      ],
    });
  });

  it("does not infer missing amounts from unrelated reservation fields", () => {
    const reservationWithDatesOnly = {
      grossAmountCents: null,
      currency: "EUR",
      checkIn: "2026-08-01",
      checkOut: "2026-08-10",
    };

    expect(summarizeStoredGrossAmounts([reservationWithDatesOnly])).toEqual({
      knownCount: 0,
      unknownCount: 1,
      totalsByCurrency: [],
    });
  });
});

describe("summarizeRevenueBreakdown", () => {
  // Mirrors a real season: four direct stays plus one Booking.com stay.
  const season = [
    { /* Robert */ checkIn: "2027-05-10", checkOut: "2027-05-16", platform: "direct", grossAmountCents: 42000 },
    { /* Polen */ checkIn: "2027-05-16", checkOut: "2027-05-28", platform: "direct", grossAmountCents: 72000 },
    { /* Iryna */ checkIn: "2027-06-30", checkOut: "2027-07-04", platform: "booking", grossAmountCents: 60225 },
    { /* Zagreb */ checkIn: "2027-08-07", checkOut: "2027-08-17", platform: "direct", grossAmountCents: 90000 },
    { /* Krajci */ checkIn: "2027-08-18", checkOut: "2027-08-27", platform: "direct", grossAmountCents: 100000 },
  ];

  it("groups by check-in month without splitting a stay across months", () => {
    const { byMonth } = summarizeRevenueBreakdown(season);

    // Iryna spans 30 Jun – 4 Jul; she belongs wholly to June, because
    // apportioning her nightly would invent a figure nobody entered.
    expect(byMonth).toEqual([
      { month: "2027-05", currency: "EUR", amountCents: 114000, bookings: 2, nights: 18 },
      { month: "2027-06", currency: "EUR", amountCents: 60225, bookings: 1, nights: 4 },
      { month: "2027-08", currency: "EUR", amountCents: 190000, bookings: 2, nights: 19 },
    ]);
  });

  it("groups by channel, largest first", () => {
    const { byChannel } = summarizeRevenueBreakdown(season);

    expect(byChannel).toEqual([
      { platform: "direct", currency: "EUR", amountCents: 304000, bookings: 4, nights: 37 },
      { platform: "booking", currency: "EUR", amountCents: 60225, bookings: 1, nights: 4 },
    ]);
  });

  it("computes the average nightly rate from stored amounts only", () => {
    const { averageNightlyCents } = summarizeRevenueBreakdown(season);

    // (364225 cents) / 41 nights = 8883.5 -> 8884
    expect(averageNightlyCents).toEqual([{ currency: "EUR", amountCents: 8884 }]);
  });

  it("ignores bookings without a stored amount", () => {
    const result = summarizeRevenueBreakdown([
      ...season,
      { /* Unpriced */ checkIn: "2027-07-20", checkOut: "2027-07-26", platform: "booking" },
    ]);

    expect(result.byMonth.some((row) => row.month === "2027-07")).toBe(false);
    expect(result.byChannel.find((row) => row.platform === "booking")?.bookings).toBe(1);
  });

  it("keeps currencies apart", () => {
    const { byMonth, averageNightlyCents } = summarizeRevenueBreakdown([
      { checkIn: "2027-05-01", checkOut: "2027-05-03", grossAmountCents: 20000, currency: "EUR" },
      { checkIn: "2027-05-01", checkOut: "2027-05-03", grossAmountCents: 30000, currency: "USD" },
    ]);

    expect(byMonth).toHaveLength(2);
    expect(averageNightlyCents).toEqual([
      { currency: "EUR", amountCents: 10000 },
      { currency: "USD", amountCents: 15000 },
    ]);
  });

  it("still counts an amount when the date range is unusable", () => {
    const { byChannel, averageNightlyCents } = summarizeRevenueBreakdown([
      { checkIn: "2027-05-05", checkOut: "2027-05-05", platform: "direct", grossAmountCents: 5000 },
    ]);

    // Zero-night range: the money is real, the nightly rate is not derivable.
    expect(byChannel[0].amountCents).toBe(5000);
    expect(byChannel[0].nights).toBe(0);
    expect(averageNightlyCents).toEqual([]);
  });

  it("returns empty structures for no input", () => {
    expect(summarizeRevenueBreakdown([])).toEqual({
      byMonth: [],
      byChannel: [],
      averageNightlyCents: [],
    });
  });
});
