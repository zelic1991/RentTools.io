import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseICal } from "@/lib/ical";
import { requireSuperadmin } from "@/lib/auth";
import { fetchIcalText } from "@/lib/ical-fetch";

interface FeedStatus {
  url: string;
  status: "ok" | "error" | "missing";
  eventCount: number;
  error?: string;
}

interface PropertyHealth {
  id: number;
  name: string;
  airbnbFeed: FeedStatus;
  bookingFeed: FeedStatus;
}

async function checkFeed(url: string | undefined): Promise<FeedStatus> {
  if (!url) {
    return { url: "", status: "missing", eventCount: 0 };
  }
  try {
    // Use the same DNS-pinned, redirect-validating, size-limited transport as
    // the real sync path. A property owner controls this URL; superadmin-only
    // access does not make a raw server-side fetch safe.
    const text = await fetchIcalText(url, {
      timeoutMs: 15_000,
      userAgent: "RentTool-CalendarHealth/1.0",
    });
    if (!text.includes("VCALENDAR")) {
      return {
        url,
        status: "error",
        eventCount: 0,
        error: "Response is not a valid iCal feed",
      };
    }
    const events = parseICal(text);
    return { url, status: "ok", eventCount: events.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url,
      status: "error",
      eventCount: 0,
      error: msg.includes("abort") ? "Connection timed out (15s)" : msg,
    };
  }
}

// Superadmin-only — this endpoint surfaces every property's iCal URLs across
// the platform. Airbnb iCal URLs embed a per-listing access token, so the
// payload is sensitive even though no booking detail is included directly.
export async function GET() {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;
  try {
    const properties = await prisma.property.findMany({
      orderBy: { name: "asc" },
      include: { calendarLinks: true },
    });

    const results: PropertyHealth[] = await Promise.all(
      properties.map(async (p) => {
        const airbnbLink = p.calendarLinks.find((l) => l.platform === "airbnb");
        const bookingLink = p.calendarLinks.find((l) => l.platform === "booking");
        const [airbnbFeed, bookingFeed] = await Promise.all([
          checkFeed(airbnbLink?.icalExportUrl),
          checkFeed(bookingLink?.icalExportUrl),
        ]);
        return {
          id: p.id,
          name: p.name,
          airbnbFeed,
          bookingFeed,
        };
      })
    );

    return NextResponse.json({ properties: results });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
