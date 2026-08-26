import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadProperty } from "@/lib/ownership";

// Redacted occupancy endpoint for operational screens. Unlike /calendar/sync
// it exposes neither SyncLog rows nor original event summaries/guest names.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const propertyId = Number(request.nextUrl.searchParams.get("propertyId"));
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid propertyId" }, { status: 400 });
  }
  if (!(await canReadProperty(propertyId, session.userId, session.role))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.calendarEvent.findMany({
    where: { propertyId },
    select: {
      id: true,
      platform: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json({
    events: rows.map((row) => ({ ...row, summary: "Guest" })),
  });
}
