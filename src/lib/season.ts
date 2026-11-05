/**
 * A rental season as calendar months, 1-12, both ends included. May to
 * September is { start: 5, end: 9 }. A season may wrap the new year
 * (November to March is { start: 11, end: 3 }). No season means the
 * property is open all year.
 *
 * Occupancy uses it so that months the property is closed do not count as
 * empty nights: 30 booked nights in a May-September flat is 20 %, not 8 %.
 */

export interface Season {
  start: number;
  end: number;
}

const DAY_MS = 86_400_000;

function isMonth(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 12;
}

/** The property's season, or null when it is open all year or the stored pair is incomplete. */
export function seasonOf(property: {
  seasonStartMonth?: number | null;
  seasonEndMonth?: number | null;
}): Season | null {
  const { seasonStartMonth: start, seasonEndMonth: end } = property;
  return isMonth(start) && isMonth(end) ? { start, end } : null;
}

/**
 * Validates a PATCH body pair. Both null clears the season (open all year);
 * otherwise both must be months 1-12. Returns null when the pair is invalid.
 */
export function parseSeasonPatch(
  start: unknown,
  end: unknown,
): { start: number | null; end: number | null } | null {
  if (start === null && end === null) return { start: null, end: null };
  if (isMonth(start) && isMonth(end)) return { start, end };
  return null;
}

/** Whether a 1-12 month falls inside the season. */
export function monthInSeason(month: number, season: Season | null): boolean {
  if (!season) return true;
  return season.start <= season.end
    ? month >= season.start && month <= season.end
    : month >= season.start || month <= season.end;
}

/**
 * Days (nights) in [from, to) that fall inside the season. Both bounds are
 * local-midnight Dates, as the reports use them.
 */
export function seasonDaysBetween(from: Date, to: Date, season: Season | null): number {
  if (to <= from) return 0;
  if (!season) return Math.round((to.getTime() - from.getTime()) / DAY_MS);
  let count = 0;
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (day < to) {
    if (monthInSeason(day.getMonth() + 1, season)) count += 1;
    day.setDate(day.getDate() + 1);
  }
  return count;
}

/**
 * The season that is running now or comes next, as [from, to) local-midnight
 * Dates. `year` is the year it starts in. Null without a season.
 */
export function currentOrNextSeason(
  today: Date,
  season: Season | null,
): { from: Date; to: Date; year: number } | null {
  if (!season) return null;
  const wraps = season.start > season.end;
  for (let year = today.getFullYear() - 1; year <= today.getFullYear() + 1; year++) {
    const from = new Date(year, season.start - 1, 1);
    const to = new Date(wraps ? year + 1 : year, season.end, 1);
    if (to > today) return { from, to, year };
  }
  return null;
}
