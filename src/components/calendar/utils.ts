export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

export function timeToPercent(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return ((h * 60 + (m || 0)) / 1440) * 100;
}

/**
 * Every date string from `a` to `b` inclusive, ascending. Order of the
 * arguments doesn't matter — shift-clicking backwards through the
 * calendar is as valid as forwards.
 *
 * Used for shift-click range selection: picking a 10-night stay should
 * cost two clicks, not ten.
 */
export function expandDateRange(a: string, b: string): string[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d);
  return out;
}

export function dayCount(start: string, end: string): number {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

import { toBcp47 } from "@/lib/i18n/locale-tags";
import type { Locale } from "@/lib/i18n/translations";

export function formatDate(d: string, locale: Locale): string {
  return new Date(d + "T12:00:00").toLocaleDateString(
    toBcp47(locale),
    { day: "2-digit", month: "short" }
  );
}
