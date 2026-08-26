import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { fetchIcalText } from "@/lib/ical-fetch";

/**
 * POST /api/onboard/test-platform
 *
 * Sanity-check an iCal export URL the visitor pasted in the onboarding
 * wizard. Binary outcome: { ok: true } if the URL is reachable AND the
 * first ~512 bytes look like a VCALENDAR; { ok: false, reason } otherwise.
 *
 * Deliberately NOT a 3-state check (valid / valid-but-empty / invalid):
 * a freshly-generated Vrbo or Booking URL can return zero events for
 * 5-15 minutes after the platform creates it, and a "yellow, no events"
 * status during onboarding confuses people who are still wondering if
 * they pasted the right thing. Real fetch + event-count diagnostics live
 * post-signup in the dashboard's sync log.
 *
 * Rate-limit aggressively per IP — paste-and-test is cheap on the server
 * but we don't want a single bad actor hammering Airbnb / Booking through us.
 */

const FETCH_TIMEOUT_MS = 5000;
const PEEK_BYTES = 512;
type Reason = "missing_url" | "bad_url" | "unreachable" | "not_ical" | "rate_limited";

interface TestRequest {
  url?: string;
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`onboard-test:${clientIp(request)}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" satisfies Reason, retryAfter: rl.resetSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetSeconds) } }
    );
  }

  let body: TestRequest;
  try {
    body = (await request.json()) as TestRequest;
  } catch {
    return NextResponse.json({ ok: false, reason: "missing_url" satisfies Reason }, { status: 400 });
  }

  const raw = (body.url ?? "").trim();
  if (!raw) {
    return NextResponse.json({ ok: false, reason: "missing_url" satisfies Reason }, { status: 400 });
  }

  let text: string;
  try {
    text = await fetchIcalText(raw, {
      timeoutMs: FETCH_TIMEOUT_MS,
      userAgent: "RentTools-Onboarding/1.0 (+https://renttools.io)",
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" satisfies Reason });
  }

  // Inspect the first ~512 bytes. iCal MUST start with BEGIN:VCALENDAR
  // (RFC 5545 §3.4) — anything else (HTML login page, JSON error,
  // empty body) means the URL isn't an iCal feed.
  const head = text.substring(0, PEEK_BYTES);
  const trimmed = head.trim();
  if (!trimmed.startsWith("BEGIN:VCALENDAR")) {
    return NextResponse.json({ ok: false, reason: "not_ical" satisfies Reason });
  }

  return NextResponse.json({ ok: true });
}
