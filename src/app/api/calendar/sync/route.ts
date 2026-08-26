import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAllCalendars } from "@/lib/calendar-sync";
import { getSession } from "@/lib/auth";
import {
  canManageProperty,
  canReadProperty,
  listAccessiblePropertyIds,
  listManageablePropertyIds,
} from "@/lib/ownership";

// POST /api/calendar/sync — trigger a manual sync.
//
// Scoped to the caller: a manual press never syncs other hosts' feeds.
//  - body { propertyId } → sync just that one property (the calendar
//    view's "Sync now" button sends this).
//  - no body            → sync every property the caller can access
//    (the top-bar "Refresh all" button).
// The 10-minute background cron remains the only system-wide sync.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let propertyId: number | null = null;
    try {
      const body = await request.json();
      if (body && body.propertyId != null) propertyId = Number(body.propertyId);
    } catch {
      // No / empty body — fall through to the "all my properties" path.
    }

    let propertyIds: number[];
    if (propertyId != null && !Number.isNaN(propertyId)) {
      if (!(await canManageProperty(propertyId, session.userId, session.role))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      propertyIds = [propertyId];
    } else {
      propertyIds = await listManageablePropertyIds(session.userId);
    }

    if (propertyIds.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await syncAllCalendars({ propertyIds });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/calendar/sync — get sync logs + events scoped to current user's properties
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Sync logs and imported CalendarEvent rows contain provider diagnostics
    // and may contain the source platform's unredacted event summary. Cleaners
    // only need the operational turnover DTOs, never the raw sync surface.
    if (session.role === "cleaner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const propertyId = request.nextUrl.searchParams.get("propertyId");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "50");

    // Resolve which propertyIds this owner/manager can access. Never include
    // global (propertyId=null) logs in a tenant response: they can describe a
    // different owner's background sync.
    const ownedIds = await listAccessiblePropertyIds(session.userId, session.role);

    if (propertyId) {
      const numId = Number(propertyId);
      if (!(await canReadProperty(numId, session.userId, session.role))) {
        return NextResponse.json({ logs: [], events: [] });
      }
    }

    const propertyFilter = propertyId
      ? { propertyId: Number(propertyId) }
      : { propertyId: { in: ownedIds } };

    const logsWhere = propertyId
      ? { propertyId: Number(propertyId) }
      : { propertyId: { in: ownedIds } };

    const [logs, events] = await Promise.all([
      prisma.syncLog.findMany({
        where: logsWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.calendarEvent.findMany({
        where: propertyFilter,
        orderBy: { startDate: "asc" },
      }),
    ]);

    return NextResponse.json({ logs, events });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
