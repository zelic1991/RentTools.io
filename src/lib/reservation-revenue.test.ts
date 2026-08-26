import { describe, expect, it } from "vitest";
import {
  normalizeCurrencyCode,
  parseGrossAmountText,
  summarizeStoredGrossAmounts,
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
