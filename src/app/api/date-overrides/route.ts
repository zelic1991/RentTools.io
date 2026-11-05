import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageProperty, canReadProperty } from "@/lib/ownership";

// GET /api/date-overrides?propertyId=1
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const propertyId = request.nextUrl.searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 }
      );
    }

    const numId = Number(propertyId);
    if (!(await canReadProperty(numId, session.userId, session.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const overrides = await prisma.dateOverride.findMany({
      where: { propertyId: numId },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(overrides);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/date-overrides — toggle a date override (create or delete)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { propertyId, date, type, note } = body;

    if (!propertyId || !date || !type) {
      return NextResponse.json(
        { error: "propertyId, date, and type are required" },
        { status: 400 }
      );
    }

    // "open"     — force this date open even if buffer / min-nights would
    //              otherwise mark it unavailable.
    // "closed"   — block bookings on this date with no other intent.
    // "cleaning" — block bookings AND surface a "Manual cleaning" chip,
    //              so the user can schedule a deliberate cleaning slot
    //              that is visually distinct from a generic block.
    if (!["open", "closed", "cleaning"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'open', 'closed', or 'cleaning'" },
        { status: 400 }
      );
    }

    const numId = Number(propertyId);
    if (!(await canManageProperty(numId, session.userId, session.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Upsert: if same type exists, remove it (toggle off). If different type or none, set it.
    const existing = await prisma.dateOverride.findUnique({
      where: { propertyId_date: { propertyId: numId, date } },
    });

    if (existing && existing.type === type) {
      // Toggle off — remove the override
      await prisma.dateOverride.delete({ where: { id: existing.id } });
      await logAudit(session.userId, "delete", "override", existing.id, {
        propertyId: numId,
        date,
        type,
      });
      return NextResponse.json({ action: "removed", date, type });
    }

    // Create or update
    const override = await prisma.dateOverride.upsert({
      where: { propertyId_date: { propertyId: numId, date } },
      update: { type, note: note || "" },
      create: {
        propertyId: numId,
        date,
        type,
        note: note || "",
      },
    });
    await logAudit(
      session.userId,
      existing ? "update" : "create",
      "override",
      override.id,
      { propertyId: numId, date, type }
    );

    return NextResponse.json({ action: "created", override });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDay(value: unknown): value is string {
  return typeof value === "string" && ISO_DAY.test(value);
}

// PATCH /api/date-overrides — set or clear how long a block is held.
// Body: { propertyId, from, to, holdUntil } with [from, to) and holdUntil
// a YYYY-MM-DD day or null. Only "closed" days in the range change.
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { propertyId, from, to, holdUntil } = body ?? {};
    if (!isIsoDay(from) || !isIsoDay(to) || from >= to || (holdUntil !== null && !isIsoDay(holdUntil))) {
      return NextResponse.json({ error: "from, to and holdUntil must be YYYY-MM-DD" }, { status: 400 });
    }
    const numId = Number(propertyId);
    if (!(await canManageProperty(numId, session.userId, session.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.dateOverride.updateMany({
      where: { propertyId: numId, type: "closed", date: { gte: from, lt: to } },
      data: { holdUntil },
    });
    await logAudit(session.userId, "update", "override", numId, {
      propertyId: numId,
      from,
      to,
      holdUntil,
      count: updated.count,
    });
    return NextResponse.json({ action: "updated", count: updated.count });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/date-overrides?propertyId=1&date=2025-04-10
// DELETE /api/date-overrides?propertyId=1&from=2027-06-14&to=2027-06-24
//   lifts every block in [from, to) at once. Cleaning and open overrides
//   in the range stay.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const propertyId = request.nextUrl.searchParams.get("propertyId");
    const date = request.nextUrl.searchParams.get("date");
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    if (propertyId && !date && (from || to)) {
      if (!isIsoDay(from) || !isIsoDay(to) || from >= to) {
        return NextResponse.json({ error: "from and to must be YYYY-MM-DD, from before to" }, { status: 400 });
      }
      const numId = Number(propertyId);
      if (!(await canManageProperty(numId, session.userId, session.role))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const removed = await prisma.dateOverride.deleteMany({
        where: { propertyId: numId, type: "closed", date: { gte: from, lt: to } },
      });
      await logAudit(session.userId, "delete", "override", numId, {
        propertyId: numId,
        from,
        to,
        count: removed.count,
      });
      return NextResponse.json({ action: "removed", from, to, count: removed.count });
    }

    if (!propertyId || !date) {
      return NextResponse.json(
        { error: "propertyId and date are required" },
        { status: 400 }
      );
    }

    const numId = Number(propertyId);
    if (!(await canManageProperty(numId, session.userId, session.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      const removed = await prisma.dateOverride.delete({
        where: {
          propertyId_date: {
            propertyId: numId,
            date,
          },
        },
      });
      await logAudit(session.userId, "delete", "override", removed.id, {
        propertyId: numId,
        date,
      });
      return NextResponse.json({ action: "removed", date });
    } catch {
      return NextResponse.json({ action: "not_found", date });
    }
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
