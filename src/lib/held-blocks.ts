/**
 * Blocks held for a guest who has not confirmed yet. The host sets the last
 * day of the hold; once it has passed, the block is still there (nothing is
 * lifted on its own) but the phone lists it so the host can lift it in one
 * tap. Without this, a hold for an unanswered enquiry kept the dates off
 * every portal long after the guest's deadline.
 */

export interface HeldOverrideInput {
  date: string; // YYYY-MM-DD
  type: string;
  holdUntil: string | null;
}

export interface ExpiredHold {
  /** First blocked day, inclusive. */
  from: string;
  /** Day after the last blocked day. */
  to: string;
  holdUntil: string;
}

function nextDay(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

/** Runs of upcoming blocked days whose hold ended before `today`. */
export function findExpiredHolds(overrides: HeldOverrideInput[], today: string): ExpiredHold[] {
  const days = overrides
    .filter(
      (row) =>
        row.type === "closed" &&
        row.holdUntil !== null &&
        row.holdUntil < today &&
        row.date >= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const runs: ExpiredHold[] = [];
  for (const row of days) {
    const last = runs[runs.length - 1];
    if (last && last.to === row.date && last.holdUntil === row.holdUntil) {
      last.to = nextDay(row.date);
    } else {
      runs.push({ from: row.date, to: nextDay(row.date), holdUntil: row.holdUntil as string });
    }
  }
  return runs;
}
