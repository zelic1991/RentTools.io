import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPropertyAccess, listAccessiblePropertyIds } from "@/lib/ownership";
import {
  canTransitionCleaning,
  canonicalCleaningStatus,
  type CleaningActor,
} from "@/lib/cleaning-workflow";

export const dynamic = "force-dynamic";

type CleaningRecordRow = {
  id: number;
  propertyId: number;
  date: string;
  status: string;
  assignedCleanerId: number | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  issueAt: Date | null;
  doneAt: Date | null;
  doneByUserId: number | null;
  updatedByUserId: number | null;
  notes: string;
  photos: string;
  createdAt: Date;
  updatedAt: Date | null;
};

// Generated Prisma output is ignored by git and refreshed from schema.prisma
// during install. This structural type keeps source checks valid before that
// generated artifact is refreshed in an existing local checkout.
type CleaningRecordStore = {
  findMany(args: unknown): Promise<CleaningRecordRow[]>;
  findUnique(args: unknown): Promise<CleaningRecordRow | null>;
  create(args: unknown): Promise<CleaningRecordRow>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

const cleaningRecords = prisma.cleaningRecord as unknown as CleaningRecordStore;

function publicRecord(record: CleaningRecordRow) {
  return {
    ...record,
    status: canonicalCleaningStatus(record.status) ?? "ISSUE",
  };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// GET /api/cleaning-records?propertyId=X[&propertyIds=1,2,3]
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const propertyId = request.nextUrl.searchParams.get("propertyId");
    const propertyIdsRaw = request.nextUrl.searchParams.get("propertyIds");

    let scopedIds: number[] = [];
    if (propertyId) {
      const numId = Number(propertyId);
      if (!Number.isInteger(numId) || numId <= 0) {
        return NextResponse.json({ error: "Invalid propertyId" }, { status: 400 });
      }
      if ((await getPropertyAccess(numId, session.userId, session.role)) === "none") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      scopedIds = [numId];
    } else if (propertyIdsRaw) {
      const ids = propertyIdsRaw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
      const allowed = await Promise.all(
        ids.map(async (id) => (
          await getPropertyAccess(id, session.userId, session.role)
        ) !== "none"),
      );
      scopedIds = ids.filter((_, index) => allowed[index]);
    } else {
      scopedIds = await listAccessiblePropertyIds(session.userId, session.role);
    }

    if (scopedIds.length === 0) return NextResponse.json({ records: [] });

    const records = await cleaningRecords.findMany({
      where: {
        propertyId: { in: scopedIds },
        // Property assignment grants a cleaner access to the operational
        // area, not to another cleaner's tasks, notes or issue reports.
        ...(session.role === "cleaner"
          ? { assignedCleanerId: session.userId }
          : {}),
      },
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ records: records.map(publicRecord) });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/cleaning-records
// body { propertyId, date, status, notes?, assignedCleanerId? }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as {
      propertyId?: unknown;
      date?: unknown;
      status?: unknown;
      notes?: unknown;
      assignedCleanerId?: unknown;
    };
    const propertyId = Number(body.propertyId);
    const target = canonicalCleaningStatus(body.status);
    if (!Number.isInteger(propertyId) || propertyId <= 0 || !validDate(body.date) || !target) {
      return NextResponse.json(
        { error: "propertyId, YYYY-MM-DD date, and a valid status are required" },
        { status: 400 },
      );
    }

    const access = await getPropertyAccess(propertyId, session.userId, session.role);
    if (access === "none") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const actor: CleaningActor = access === "cleaner" ? "cleaner" : "manager";

    const existing = await cleaningRecords.findUnique({
      where: { propertyId_date: { propertyId, date: body.date } },
    });
    const current = existing ? canonicalCleaningStatus(existing.status) : null;
    if (existing && !current) {
      return NextResponse.json({ error: "Unknown stored cleaning status" }, { status: 409 });
    }
    if (!canTransitionCleaning(current, target, actor)) {
      return NextResponse.json(
        { error: `Transition ${current ?? "NEW"} -> ${target} is not allowed for ${actor}` },
        { status: 409 },
      );
    }

    let assignedCleanerId = existing?.assignedCleanerId ?? null;
    if (actor === "manager" && target === "ASSIGNED") {
      assignedCleanerId = Number(body.assignedCleanerId);
      if (!Number.isInteger(assignedCleanerId) || assignedCleanerId <= 0) {
        return NextResponse.json({ error: "assignedCleanerId is required" }, { status: 400 });
      }
      const activeAssignment = await prisma.cleanerAssignment.findUnique({
        where: { cleanerId_propertyId: { cleanerId: assignedCleanerId, propertyId } },
        select: { id: true },
      });
      if (!activeAssignment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (actor === "cleaner") {
      if (assignedCleanerId !== session.userId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const activeAssignment = await prisma.cleanerAssignment.findUnique({
        where: { cleanerId_propertyId: { cleanerId: session.userId, propertyId } },
        select: { id: true },
      });
      if (!activeAssignment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const now = new Date();
    const notes = typeof body.notes === "string" ? body.notes : existing?.notes ?? "";
    if (!existing) {
      const record = await cleaningRecords.create({
        data: {
          propertyId,
          date: body.date,
          status: "PLANNED",
          notes,
          updatedByUserId: session.userId,
        },
      });
      return NextResponse.json({ record: publicRecord(record) });
    }

    const transitionData: Record<string, string | number | Date | null> = {
      status: target,
      notes,
      updatedAt: now,
      updatedByUserId: session.userId,
    };
    if (target === "PLANNED") {
      Object.assign(transitionData, {
        assignedCleanerId: null,
        assignedAt: null,
        startedAt: null,
        issueAt: null,
        doneAt: null,
        doneByUserId: null,
      });
    } else if (target === "ASSIGNED") {
      Object.assign(transitionData, {
        assignedCleanerId,
        assignedAt: now,
        startedAt: null,
        issueAt: null,
        doneAt: null,
        doneByUserId: null,
      });
    } else if (target === "IN_PROGRESS") {
      transitionData.startedAt = now;
    } else if (target === "READY") {
      transitionData.doneAt = now;
      transitionData.doneByUserId = session.userId;
      transitionData.issueAt = null;
    } else if (target === "ISSUE") {
      transitionData.issueAt = now;
      transitionData.doneAt = null;
      transitionData.doneByUserId = null;
    }

    // Compare the raw stored state and assignee as part of the update. A
    // concurrent transition/reassignment therefore cannot be overwritten.
    const updated = await cleaningRecords.updateMany({
      where: {
        id: existing.id,
        status: existing.status,
        assignedCleanerId: existing.assignedCleanerId,
      },
      data: transitionData,
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Cleaning record changed concurrently; reload and retry" },
        { status: 409 },
      );
    }

    const record = await cleaningRecords.findUnique({ where: { id: existing.id } });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ record: publicRecord(record) });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
