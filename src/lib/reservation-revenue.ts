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
