/**
 * Portal fees and the net amount the host can expect.
 *
 * Booking.com keeps a commission plus a payment fee (15 % + 1.35 % for the
 * Nepužlan stay: 829,00 € → 135,52 € fees → 693,48 €). The stored amount stays
 * the gross figure the guest pays; the net shown next to it is an expectation:
 * - a booking with its own `feeCents` (taken from the extranet) uses that;
 * - otherwise the property's rate for the channel is applied;
 * - direct bookings carry no portal fee;
 * - a portal booking without either stays "unknown", never guessed.
 */

import { normalizeCurrencyCode } from "@/lib/reservation-revenue";

export interface FeeRates {
  bookingFeeBp?: number | null;
  airbnbFeeBp?: number | null;
}

export interface FeeReservation {
  platform?: string | null;
  grossAmountCents?: number | null;
  feeCents?: number | null;
  currency?: string | null;
}

/** 1635 → 16.35 %. Accepts 0-5000 (0-50 %) or null; anything else is undefined. */
export function parseFeeRateBp(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5000) {
    return value as number;
  }
  return undefined;
}

function rateFor(platform: string | null | undefined, rates: FeeRates): number | null {
  const key = (platform ?? "").toLowerCase();
  if (key === "booking") return rates.bookingFeeBp ?? null;
  if (key === "airbnb") return rates.airbnbFeeBp ?? null;
  return 0;
}

/**
 * Fees for one booking: its own figure, else gross × channel rate, else null
 * (portal booking with no rate set). Null also when there is no gross amount.
 */
export function reservationFeeCents(
  reservation: FeeReservation,
  rates: FeeRates,
): { feeCents: number; source: "actual" | "rate" | "none" } | null {
  const gross = reservation.grossAmountCents;
  if (!Number.isSafeInteger(gross) || (gross as number) < 0) return null;
  if (Number.isSafeInteger(reservation.feeCents) && (reservation.feeCents as number) >= 0) {
    return { feeCents: reservation.feeCents as number, source: "actual" };
  }
  const rate = rateFor(reservation.platform, rates);
  if (rate === null) return null;
  if (rate === 0) return { feeCents: 0, source: "none" };
  return { feeCents: Math.round(((gross as number) * rate) / 10_000), source: "rate" };
}

export interface NetSummary {
  /** Per currency: gross and fees of the bookings whose fees are known. */
  totalsByCurrency: Array<{ currency: string; grossCents: number; feeCents: number; netCents: number }>;
  /** Net per channel and currency, same bookings. */
  byChannel: Array<{ platform: string; currency: string; netCents: number; feeCents: number }>;
  /** Bookings with a stored amount but no fee figure or rate (portal only). */
  unknownFeeCount: number;
  /** Bookings whose fees come from the channel rate, not the extranet. */
  estimatedCount: number;
}

export function summarizeNetAmounts(reservations: FeeReservation[], rates: FeeRates): NetSummary {
  const totals = new Map<string, { grossCents: number; feeCents: number }>();
  const channels = new Map<string, { platform: string; currency: string; netCents: number; feeCents: number }>();
  let unknownFeeCount = 0;
  let estimatedCount = 0;

  for (const reservation of reservations) {
    const gross = reservation.grossAmountCents;
    const currency = normalizeCurrencyCode(reservation.currency ?? "EUR");
    if (!Number.isSafeInteger(gross) || (gross as number) < 0 || !currency) continue;
    const fee = reservationFeeCents(reservation, rates);
    if (!fee) {
      unknownFeeCount++;
      continue;
    }
    if (fee.source === "rate") estimatedCount++;

    const total = totals.get(currency) ?? { grossCents: 0, feeCents: 0 };
    total.grossCents += gross as number;
    total.feeCents += fee.feeCents;
    totals.set(currency, total);

    const platform = (reservation.platform || "direct").toLowerCase();
    const key = `${platform}|${currency}`;
    const row = channels.get(key) ?? { platform, currency, netCents: 0, feeCents: 0 };
    row.netCents += (gross as number) - fee.feeCents;
    row.feeCents += fee.feeCents;
    channels.set(key, row);
  }

  return {
    totalsByCurrency: Array.from(totals, ([currency, t]) => ({
      currency,
      grossCents: t.grossCents,
      feeCents: t.feeCents,
      netCents: t.grossCents - t.feeCents,
    })).sort((a, b) => a.currency.localeCompare(b.currency)),
    byChannel: Array.from(channels.values()).sort((a, b) => b.netCents - a.netCents),
    unknownFeeCount,
    estimatedCount,
  };
}

/** "16,35 %" style label for a basis-point rate. */
export function formatFeeRate(bp: number, localeTag: string): string {
  return `${new Intl.NumberFormat(localeTag, { maximumFractionDigits: 2 }).format(bp / 100)} %`;
}
