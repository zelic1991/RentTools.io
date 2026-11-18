import { describe, expect, it } from "vitest";
import { parseFeeRateBp, reservationFeeCents, summarizeNetAmounts } from "./channel-fees";

const rates = { bookingFeeBp: 1635, airbnbFeeBp: null };

describe("reservationFeeCents", () => {
  it("applies the Booking.com rate (Nepužlan: 829 € → about 135.54 € fees)", () => {
    expect(reservationFeeCents({ platform: "booking", grossAmountCents: 82_900 }, rates)).toEqual({
      feeCents: 13_554,
      source: "rate",
    });
  });

  it("prefers the actual fee from the extranet (135.52 €)", () => {
    expect(
      reservationFeeCents({ platform: "booking", grossAmountCents: 82_900, feeCents: 13_552 }, rates),
    ).toEqual({ feeCents: 13_552, source: "actual" });
  });

  it("charges nothing on a direct booking", () => {
    expect(reservationFeeCents({ platform: "direct", grossAmountCents: 100_000 }, rates)).toEqual({
      feeCents: 0,
      source: "none",
    });
  });

  it("does not guess a portal fee without a rate or a gross amount", () => {
    expect(reservationFeeCents({ platform: "airbnb", grossAmountCents: 50_000 }, rates)).toBeNull();
    expect(reservationFeeCents({ platform: "booking", grossAmountCents: null }, rates)).toBeNull();
  });
});

describe("summarizeNetAmounts", () => {
  it("totals gross, fees and net, and counts estimates and unknowns", () => {
    const summary = summarizeNetAmounts(
      [
        { platform: "booking", grossAmountCents: 82_900, feeCents: 13_552 },
        { platform: "booking", grossAmountCents: 95_200 },
        { platform: "direct", grossAmountCents: 114_000 },
        { platform: "airbnb", grossAmountCents: 40_000 },
        { platform: "booking", grossAmountCents: null },
      ],
      rates,
    );
    // 952 € × 16.35 % = 155.65 €
    expect(summary.totalsByCurrency).toEqual([
      { currency: "EUR", grossCents: 292_100, feeCents: 13_552 + 15_565, netCents: 292_100 - 29_117 },
    ]);
    expect(summary.byChannel).toEqual([
      { platform: "booking", currency: "EUR", netCents: 82_900 - 13_552 + 95_200 - 15_565, feeCents: 29_117 },
      { platform: "direct", currency: "EUR", netCents: 114_000, feeCents: 0 },
    ]);
    expect(summary.unknownFeeCount).toBe(1);
    expect(summary.estimatedCount).toBe(1);
  });
});

describe("parseFeeRateBp", () => {
  it("accepts 0-5000 and null, rejects the rest", () => {
    expect(parseFeeRateBp(1635)).toBe(1635);
    expect(parseFeeRateBp(null)).toBeNull();
    expect(parseFeeRateBp(-1)).toBeUndefined();
    expect(parseFeeRateBp(5001)).toBeUndefined();
    expect(parseFeeRateBp(16.35)).toBeUndefined();
    expect(parseFeeRateBp("1635")).toBeUndefined();
  });
});
