export interface ReservationRevenueInput {
  grossAmountCents?: unknown;
  currency?: unknown;
}

export type ReservationRevenuePatch = {
  grossAmountCents?: number | null;
  currency?: string;
};

type ValidationResult =
  | { ok: true; data: ReservationRevenuePatch }
  | { ok: false; error: string };

const supportedCurrencyCodes = new Set<string>(
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("currency")
    : ["EUR"],
);

export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return supportedCurrencyCodes.has(code) ? code : null;
}

/** Validate API input without deriving a value from dates, nights, or channel. */
export function validateReservationRevenue(
  input: ReservationRevenueInput,
): ValidationResult {
  const data: ReservationRevenuePatch = {};

  if (input.grossAmountCents !== undefined) {
    if (input.grossAmountCents === null) {
      data.grossAmountCents = null;
    } else if (
      !Number.isSafeInteger(input.grossAmountCents) ||
      (input.grossAmountCents as number) < 0
    ) {
      return {
        ok: false,
        error: "grossAmountCents must be a nonnegative integer or null",
      };
    } else {
      data.grossAmountCents = input.grossAmountCents as number;
    }
  }

  if (input.currency !== undefined) {
    const currency = normalizeCurrencyCode(input.currency);
    if (!currency) {
      return { ok: false, error: "currency must be a supported ISO 4217 code" };
    }
    data.currency = currency;
  }

  return { ok: true, data };
}

export type GrossAmountTextResult =
  | { ok: true; cents: number | null }
  | { ok: false };

/** Parse a compact owner-facing decimal amount into integer cents. */
export function parseGrossAmountText(value: string): GrossAmountTextResult {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return { ok: true, cents: null };
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return { ok: false };

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents)
    ? { ok: true, cents }
    : { ok: false };
}

export interface RevenueReservation {
  grossAmountCents?: number | null;
  currency?: string | null;
}

export interface StoredGrossAmountSummary {
  knownCount: number;
  unknownCount: number;
  totalsByCurrency: Array<{ currency: string; amountCents: number }>;
}

export interface RevenueBreakdownReservation extends RevenueReservation {
  checkIn?: string | null;
  checkOut?: string | null;
  platform?: string | null;
}

export interface RevenueMonthRow {
  /** "YYYY-MM" of the check-in date. */
  month: string;
  currency: string;
  amountCents: number;
  bookings: number;
  nights: number;
}

export interface RevenueChannelRow {
  platform: string;
  currency: string;
  amountCents: number;
  bookings: number;
  nights: number;
}

export interface RevenueBreakdown {
  byMonth: RevenueMonthRow[];
  byChannel: RevenueChannelRow[];
  /** Average per night across stays that have BOTH a stored amount and a
   *  usable date range, per currency. Derived from real figures only —
   *  no rate is ever inferred for a booking without a stored amount. */
  averageNightlyCents: Array<{ currency: string; amountCents: number }>;
}

/** Nights between two ISO dates, or null when the range is unusable. */
function nightsBetween(checkIn: unknown, checkOut: unknown): number | null {
  if (typeof checkIn !== "string" || typeof checkOut !== "string") return null;
  const from = Date.parse(`${checkIn.slice(0, 10)}T12:00:00Z`);
  const to = Date.parse(`${checkOut.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const nights = Math.round((to - from) / 86_400_000);
  return nights > 0 ? nights : null;
}

/**
 * Split stored amounts by check-in month and by channel.
 *
 * Deliberately as conservative as summarizeStoredGrossAmounts: a booking
 * counts only when it carries an explicit stored amount. A stay is
 * attributed WHOLE to its check-in month — spreading it across months
 * would mean inventing per-night figures the host never entered.
 */
export function summarizeRevenueBreakdown(
  reservations: RevenueBreakdownReservation[],
): RevenueBreakdown {
  const months = new Map<string, RevenueMonthRow>();
  const channels = new Map<string, RevenueChannelRow>();
  const avgTotals = new Map<string, { amountCents: number; nights: number }>();

  for (const reservation of reservations) {
    const amount = reservation.grossAmountCents;
    const currency = normalizeCurrencyCode(reservation.currency ?? "EUR");
    if (!Number.isSafeInteger(amount) || (amount as number) < 0 || !currency) {
      continue;
    }
    const cents = amount as number;
    const nights = nightsBetween(reservation.checkIn, reservation.checkOut) ?? 0;

    const month =
      typeof reservation.checkIn === "string"
        ? reservation.checkIn.slice(0, 7)
        : "";
    if (/^\d{4}-\d{2}$/.test(month)) {
      const key = `${month}|${currency}`;
      const row = months.get(key) ?? {
        month,
        currency,
        amountCents: 0,
        bookings: 0,
        nights: 0,
      };
      row.amountCents += cents;
      row.bookings += 1;
      row.nights += nights;
      months.set(key, row);
    }

    const platform = (reservation.platform || "direct").toLowerCase();
    const channelKey = `${platform}|${currency}`;
    const channelRow = channels.get(channelKey) ?? {
      platform,
      currency,
      amountCents: 0,
      bookings: 0,
      nights: 0,
    };
    channelRow.amountCents += cents;
    channelRow.bookings += 1;
    channelRow.nights += nights;
    channels.set(channelKey, channelRow);

    if (nights > 0) {
      const acc = avgTotals.get(currency) ?? { amountCents: 0, nights: 0 };
      acc.amountCents += cents;
      acc.nights += nights;
      avgTotals.set(currency, acc);
    }
  }

  return {
    byMonth: Array.from(months.values()).sort(
      (a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency),
    ),
    byChannel: Array.from(channels.values()).sort(
      (a, b) => b.amountCents - a.amountCents || a.platform.localeCompare(b.platform),
    ),
    averageNightlyCents: Array.from(avgTotals, ([currency, acc]) => ({
      currency,
      amountCents: Math.round(acc.amountCents / acc.nights),
    })).sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

/** Sum only explicit, valid stored values. Missing/invalid rows stay unknown. */
export function summarizeStoredGrossAmounts(
  reservations: RevenueReservation[],
): StoredGrossAmountSummary {
  const totals = new Map<string, number>();
  let knownCount = 0;
  let unknownCount = 0;

  for (const reservation of reservations) {
    const amount = reservation.grossAmountCents;
    const currency = normalizeCurrencyCode(reservation.currency ?? "EUR");
    if (!Number.isSafeInteger(amount) || (amount as number) < 0 || !currency) {
      unknownCount++;
      continue;
    }
    const next = (totals.get(currency) ?? 0) + (amount as number);
    if (!Number.isSafeInteger(next)) {
      unknownCount++;
      continue;
    }
    totals.set(currency, next);
    knownCount++;
  }

  return {
    knownCount,
    unknownCount,
    totalsByCurrency: Array.from(totals, ([currency, amountCents]) => ({
      currency,
      amountCents,
    })).sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
