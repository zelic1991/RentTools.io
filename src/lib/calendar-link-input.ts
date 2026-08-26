/** Validation for host-supplied calendar-link fields.
 *
 *  Both values arrive as free text pasted from another platform's UI, and
 *  neither used to be checked at the API boundary. The costs showed up
 *  much later and far from the cause:
 *
 *    * A URL with no scheme stored fine and then failed on every sync
 *      forever with "Failed to parse URL from <host>" — one such row had
 *      accumulated failures for weeks before anyone noticed.
 *    * A platform outside a stale ["airbnb","booking"] allowlist was
 *      rejected with a 400 the UI never displayed, so hosts adding Vrbo /
 *      Rentalia / HomeToGo feeds just saw the dialog vanish.
 *
 *  Keeping both rules here means the POST and PATCH routes agree, and the
 *  messages are written to be shown to the host verbatim.
 */

export type UrlResult = { ok: true; url: string } | { ok: false; error: string };
export type PlatformResult = { ok: true; platform: string } | { ok: false; error: string };
export type CalendarBufferField = "bufferBefore" | "bufferAfter";
export type CalendarBufferResult =
  | { ok: true; present: false }
  | { ok: true; present: true; value: number }
  | { ok: false; error: string };

const MAX_URL_LENGTH = 2000;
export const CALENDAR_BUFFER_MIN = 0;
export const CALENDAR_BUFFER_MAX = 3;

export function validateCalendarBuffer(
  raw: unknown,
  field: CalendarBufferField,
): { ok: true; value: number } | { ok: false; error: string } {
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    !Number.isInteger(raw) ||
    raw < CALENDAR_BUFFER_MIN ||
    raw > CALENDAR_BUFFER_MAX
  ) {
    return {
      ok: false,
      error: `${field} must be an integer between ${CALENDAR_BUFFER_MIN} and ${CALENDAR_BUFFER_MAX}`,
    };
  }
  return { ok: true, value: raw };
}

/** Distinguish an omitted field from an explicitly invalid value such as null. */
export function parseCalendarBufferField(
  body: unknown,
  field: CalendarBufferField,
): CalendarBufferResult {
  if (
    typeof body !== "object" ||
    body === null ||
    !Object.prototype.hasOwnProperty.call(body, field)
  ) {
    return { ok: true, present: false };
  }

  const result = validateCalendarBuffer(
    (body as Record<string, unknown>)[field],
    field,
  );
  if (!result.ok) return result;
  return { ok: true, present: true, value: result.value };
}

/**
 * Old or manually damaged rows must fail safe without mutating the DB.
 * Zero preserves the original checkout-exclusive occupancy and never shortens it.
 */
export function normalizeStoredCalendarBuffer(raw: unknown): number {
  const result = validateCalendarBuffer(raw, "bufferBefore");
  return result.ok ? result.value : 0;
}

export function normalizeIcalUrl(raw: unknown): UrlResult {
  if (typeof raw !== "string") return { ok: false, error: "iCal URL is required" };

  let s = raw.trim();
  if (!s) return { ok: false, error: "iCal URL is required" };
  if (s.length > MAX_URL_LENGTH) {
    return { ok: false, error: `iCal URL is too long (max ${MAX_URL_LENGTH} characters)` };
  }

  // Several platforms hand out webcal:// links, which are plain HTTPS on
  // the wire. Swap the scheme instead of rejecting a URL the host copied
  // verbatim from the source platform.
  if (/^webcal:\/\//i.test(s)) s = s.replace(/^webcal:\/\//i, "https://");

  // A bare host ("example.com/cal.ics") is what gets pasted when someone
  // trims the scheme by hand. new URL() throws on it, and before this
  // check that throw surfaced only at sync time, as a permanent failure.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;

  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "iCal URL must use HTTPS" };
  }
  // Rejects "localhost" and bare hostnames, which can never be a hosted feed.
  if (!parsed.hostname.includes(".")) {
    return { ok: false, error: "iCal URL must include a full domain name" };
  }

  return { ok: true, url: parsed.toString() };
}

/** RentTools syncs any iCal-capable platform, so the slug is free-form
 *  rather than an allowlist — matched to what /api/onboard already accepts
 *  (lowercased, trimmed, capped at 32 chars) so the wizard and the in-app
 *  form can't disagree about what is addable. */
export function normalizePlatformSlug(raw: unknown): PlatformResult {
  if (typeof raw !== "string") return { ok: false, error: "platform is required" };

  const slug = raw.toLowerCase().trim().slice(0, 32);
  if (!slug) return { ok: false, error: "platform is required" };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return { ok: false, error: "platform must be a lowercase slug (letters, digits, hyphens)" };
  }

  return { ok: true, platform: slug };
}
