import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPropertyAccess } from "@/lib/ownership";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "cleaner" || session.impersonatorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number((await params).id);
  const body = await request.json() as { status?: unknown };
  if (!Number.isInteger(id) || id <= 0 || body.status !== "DONE") {
    return NextResponse.json({ error: "Invalid reminder update" }, { status: 400 });
  }

  const existing = await prisma.operationalReminder.findUnique({
    where: { id },
    select: { id: true, propertyId: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getPropertyAccess(existing.propertyId, session.userId, session.role);
  if (access !== "owner" && access !== "manager") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status === "DONE") return NextResponse.json({ ok: true });

  const now = new Date();
  const updated = await prisma.operationalReminder.updateMany({
    where: { id, status: "OPEN" },
    data: {
      status: "DONE",
      completedAt: now,
      completedByUserId: session.userId,
      updatedAt: now,
    },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Reminder changed concurrently" }, { status: 409 });
  }
  await logAudit(session.userId, "update", "operationalReminder", id, {
    status: "DONE",
    completedAt: now.toISOString(),
  });
  return NextResponse.json({ ok: true });
}
