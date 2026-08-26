import { NextRequest, NextResponse } from "next/server";
import { generateFeed, generateEmptyFeed, parseFeedFilename } from "@/lib/feed";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "node:crypto";

/**
 * GET /api/calendar/feed/[id]/for-airbnb.ics
 * GET /api/calendar/feed/[id]/for-booking.ics
 *
 * Primary .ics feed URL — this is what Airbnb/Booking import.
 *
 * `[id]` resolves in this order:
 *   1. Numeric — legacy `Property.id` (kept for users who pasted the
 *      old URL into Airbnb / Booking before slugs existed).
 *   2. Property.feedSlug match — durable URL minted at creation, never
 *      changes even if the property is renamed.
 *   3. OnboardingDraft.feedSlug match — protected pre-signup state. Returns
 *      an empty (but RFC-valid) calendar only with the draft bearer token,
 *      so the user can paste the URL before they've created an account.
 *      Once they sign up the draft is claimed and the slug points at a
 *      real Property — same URL keeps working.
 *
 * If the property has a feedToken set, the request must include
 * ?token=<value> matching it; otherwise we return 401. Properties
 * without a token (legacy) keep working publicly until the user
 * opts in via the rotate-feed-token endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; filename: string }> }
) {
  try {
    const { propertyId: idSegment, filename } = await params;

    // Rate limit: 60 requests per minute per IP per id segment
    const ip = clientIp(request);
    const rl = checkRateLimit(`feed:${ip}:${idSegment}`, 60, 60);
    if (!rl.ok) {
      return new NextResponse("Rate limit exceeded", {
        status: 429,
        headers: { "Retry-After": String(rl.resetSeconds) },
      });
    }

    const forPlatform = parseFeedFilename(filename);
    const numericId = /^\d+$/.test(idSegment) ? Number(idSegment) : null;

    // Resolve the id segment to a Property — match numeric id OR feedSlug.
    const property = await prisma.property.findFirst({
      where: numericId !== null
        ? { OR: [{ id: numericId }, { feedSlug: idSegment }] }
        : { feedSlug: idSegment },
      select: { id: true, feedToken: true },
    });

    if (property) {
      if (property.feedToken) {
        const provided = request.nextUrl.searchParams.get("token") ?? "";
        if (!tokensMatch(provided, property.feedToken)) {
          return new NextResponse("Unauthorized", { status: 401 });
        }
      }
      const result = await generateFeed(property.id, forPlatform);
      if ("error" in result) {
        return new NextResponse(result.error, { status: result.status });
      }
      return icalResponse(result.ical, forPlatform);
    }

    // Not a Property — try OnboardingDraft. Drafts are always protected;
    // legacy null-token rows fail closed until the cookie-authorized
    // onboarding route safely mints their identity.
    if (!numericId) {
      const draft = await prisma.onboardingDraft.findUnique({
        where: { feedSlug: idSegment },
        select: { id: true, claimedByUserId: true, feedToken: true },
      });
      if (draft && !draft.claimedByUserId) {
        const provided = request.nextUrl.searchParams.get("token") ?? "";
        if (!draft.feedToken || !tokensMatch(provided, draft.feedToken)) {
          return new NextResponse("Unauthorized", { status: 401 });
        }
        const ical = generateEmptyFeed("RentTools onboarding");
        return icalResponse(ical, forPlatform);
      }
    }

    return new NextResponse("Not found", { status: 404 });
  } catch (err) {
    console.error("Feed error:", err);
    return new NextResponse(`Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}

function icalResponse(ical: string, forPlatform: string): NextResponse {
  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="calendar-${forPlatform}.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
