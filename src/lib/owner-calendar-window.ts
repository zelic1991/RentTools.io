const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_PROPERTY_TIME_ZONE = "Europe/Zagreb";
export const OWNER_CALENDAR_PAST_MONTHS = 6;

export interface OwnerCalendarWindow {
  today: string;
  visibleFrom: string;
  /** Last night that can be occupied / last check-in date. */
  visibleUntil: string;
  /** Checkout is exclusive, so it may be one day after visibleUntil. */
  checkoutUntil: string;
  timeZone: string;
}

function assertIsoDate(value: string): void {
  if (!ISO_DATE_RE.test(value)) throw new Error(`Invalid ISO date: ${value}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
}

export function addCalendarDays(date: string, days: number): string {
  assertIsoDate(date);
  if (!Number.isInteger(days)) throw new Error("Calendar day offset must be an integer");
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function dateInTimeZone(
  now: Date,
  timeZone: string = DEFAULT_PROPERTY_TIME_ZONE,
): string {
  if (Number.isNaN(now.getTime())) throw new Error("Invalid current time");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error(`Could not resolve date in ${timeZone}`);
  return `${year}-${month}-${day}`;
}

function shiftMonthStart(date: string, monthOffset: number): string {
  assertIsoDate(date);
  const [year, month] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  return shifted.toISOString().slice(0, 10);
}

export function getOwnerCalendarWindow(options: {
  bookingWindowDays: number;
  timeZone?: string;
  now?: Date;
  pastMonths?: number;
}): OwnerCalendarWindow {
  const bookingWindowDays = options.bookingWindowDays;
  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays < 1) {
    throw new Error("bookingWindowDays must be a positive integer");
  }
  const pastMonths = options.pastMonths ?? OWNER_CALENDAR_PAST_MONTHS;
  if (!Number.isInteger(pastMonths) || pastMonths < 0) {
    throw new Error("pastMonths must be a non-negative integer");
  }
  const timeZone = options.timeZone || DEFAULT_PROPERTY_TIME_ZONE;
  const today = dateInTimeZone(options.now ?? new Date(), timeZone);
  const visibleUntil = addCalendarDays(today, bookingWindowDays);
  return {
    today,
    visibleFrom: shiftMonthStart(today, -pastMonths),
    visibleUntil,
    checkoutUntil: addCalendarDays(visibleUntil, 1),
    timeZone,
  };
}

export function ownerCalendarMonthStarts(window: OwnerCalendarWindow): string[] {
  const result: string[] = [];
  let cursor = window.visibleFrom.slice(0, 7) + "-01";
  const finalMonth = window.visibleUntil.slice(0, 7) + "-01";
  while (cursor <= finalMonth) {
    result.push(cursor);
    cursor = shiftMonthStart(cursor, 1);
  }
  return result;
}

export function isOwnerCalendarOccupancyDate(
  date: string,
  window: OwnerCalendarWindow,
): boolean {
  assertIsoDate(date);
  return date >= window.visibleFrom && date <= window.visibleUntil;
}

export function isReservationRangeInOwnerCalendarWindow(
  checkIn: string,
  checkOut: string,
  window: OwnerCalendarWindow,
): boolean {
  assertIsoDate(checkIn);
  assertIsoDate(checkOut);
  return (
    checkIn >= window.visibleFrom &&
    checkIn <= window.visibleUntil &&
    checkOut > checkIn &&
    checkOut <= window.checkoutUntil
  );
}

