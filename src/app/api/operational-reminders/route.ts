import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPropertyAccess, listManageablePropertyIds } from "@/lib/ownership";
import {
  OPERATIONAL_REMINDER_TYPES,
  isIsoDate,
  operationalReminderDedupeKey,
  parseDueAt,
  type OperationalReminderType,
} from "@/lib/operational-reminders";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const reminderSelect = {
  id: true,
  propertyId: true,
  type: true,
  portal: true,
  status: true,
  startDate: true,
  endDate: true,
  dueAt: true,
  note: true,
  completedAt: true,
  completedByUserId: true,
  createdAt: true,
  property: { select: { name: true } },
} as const;

function dto(row: {
  id: number;
  propertyId: number;
  type: string;
  portal: string;
  status: string;
  startDate: string;
  endDate: string;
  dueAt: Date;
  note: string;
  completedAt: Date | null;
  completedByUserId: number | null;
  createdAt: Date;
  property: { name: string };
}) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.property.name,
    type: row.type,
    portal: row.portal,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    dueAt: row.dueAt.toISOString(),
    note: row.note,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedByUserId: row.completedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "cleaner") return NextResponse.json({ reminders: [] });

  const requestedId = request.nextUrl.searchParams.get("propertyId");
  let propertyIds: number[];
  if (requestedId !== null) {
    const propertyId = Number(requestedId);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return NextResponse.json({ error: "Invalid propertyId" }, { status: 400 });
    }
    const access = await getPropertyAccess(propertyId, session.userId, session.role);
    if (access !== "owner" && access !== "manager") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    propertyIds = [propertyId];
  } else {
    propertyIds = await listManageablePropertyIds(session.userId);
  }

  if (propertyIds.length === 0) return NextResponse.json({ reminders: [] });
  const rows = await prisma.operationalReminder.findMany({
    // This endpoint is the open-work queue. DONE rows remain in the database
    // for audit/history, but must disappear from every open dashboard surface.
    where: { propertyId: { in: propertyIds }, status: "OPEN" },
    select: reminderSelect,
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ reminders: rows.map(dto) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "cleaner" || session.impersonatorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as Record<string, unknown>;
  const propertyId = Number(body.propertyId);
  const type = body.type as OperationalReminderType;
  const portal = typeof body.portal === "string" ? body.portal.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const dueAt = parseDueAt(body.dueAt);
  if (
    !Number.isInteger(propertyId) || propertyId <= 0
    || !OPERATIONAL_REMINDER_TYPES.includes(type)
    || !portal || portal.length > 80
    || !isIsoDate(body.startDate) || !isIsoDate(body.endDate)
    || body.startDate >= body.endDate
    || !dueAt
    || !note || note.length > 2000
  ) {
    return NextResponse.json({ error: "Invalid reminder" }, { status: 400 });
  }

  const access = await getPropertyAccess(propertyId, session.userId, session.role);
  if (access !== "owner" && access !== "manager") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dedupeKey = operationalReminderDedupeKey({
    propertyId,
    type,
    portal,
    startDate: body.startDate,
    endDate: body.endDate,
  });
  const row = await prisma.operationalReminder.upsert({
    where: { dedupeKey },
    create: {
      propertyId,
      dedupeKey,
      type,
      portal,
      status: "OPEN",
      startDate: body.startDate,
      endDate: body.endDate,
      dueAt,
      note,
      createdByUserId: session.userId,
    },
    update: {
      status: "OPEN",
      dueAt,
      note,
      completedAt: null,
      completedByUserId: null,
      updatedAt: new Date(),
    },
    select: reminderSelect,
  });
  await logAudit(session.userId, "create", "operationalReminder", row.id, {
    propertyId,
    type,
    portal,
    startDate: body.startDate,
    endDate: body.endDate,
    dueAt: dueAt.toISOString(),
  });
  return NextResponse.json({ reminder: dto(row) });
}
