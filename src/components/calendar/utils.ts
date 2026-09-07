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

/**
 * Stable palette slot for a key (a reservation id or a guest name).
 * djb2 over UTF-16 code units, folded into [0, size). Deterministic, so
 * the same guest keeps the same colour across renders, months and
 * reloads — and two neighbouring Direct stays almost always differ.
 */
export function directPaletteIndex(key: string, size: number): number {
  if (size <= 0) return 0;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return h % size;
}

/**
 * Palette slots for Direct stays, given their keys in calendar order.
 * Each stay takes its hashed slot unless that repeats the slot of the
 * stay right before it — then it moves one slot on. So two Direct
 * guests back to back never share a colour, and a guest keeps their
 * colour unless a new booking lands directly in front of them with
 * the same hash.
 */
export function assignDirectSlots(keysInDateOrder: string[], size: number): Map<string, number> {
  const out = new Map<string, number>();
  let prev = -1;
  for (const key of keysInDateOrder) {
    const known = out.get(key);
    if (known !== undefined) { prev = known; continue; }
    let slot = directPaletteIndex(key, size);
    if (size > 1 && slot === prev) slot = (slot + 1) % size;
    out.set(key, slot);
    prev = slot;
  }
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
