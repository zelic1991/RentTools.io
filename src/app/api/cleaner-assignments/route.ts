import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPropertyAccess, isPropertyOwner } from "@/lib/ownership";

export const dynamic = "force-dynamic";

// GET /api/cleaner-assignments?propertyId=X — anyone with read access
// to the property gets the cleaner list. Other property data
// (reservations, sync events, calendar overrides) is already shared
// with managers / cleaners; cleaner assignments were the odd one out
// — gating reads to owner-only meant a co-host on a shared property
// couldn't see who was cleaning it. Edit operations (POST / DELETE)
// keep the stricter isPropertyOwner check below.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const propertyIdParam = request.nextUrl.searchParams.get("propertyId");
    if (!propertyIdParam) {
      return NextResponse.json({ error: "propertyId required" }, { status: 400 });
    }
    const propertyId = parseInt(propertyIdParam);
    if (isNaN(propertyId)) {
      return NextResponse.json({ error: "Invalid propertyId" }, { status: 400 });
    }

    const access = await getPropertyAccess(propertyId, session.userId, session.role);
    if (access === "none") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cleaners only need proof of their own active login assignment. Do not
    // fetch or return coworker identities, owner-scoped profiles, or phones.
    if (access === "cleaner") {
      const assignments = await prisma.cleanerAssignment.findMany({
        where: { propertyId, cleanerId: session.userId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          propertyId: true,
          cleanerId: true,
          priority: true,
          createdAt: true,
        },
      });
      return NextResponse.json(assignments);
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { userId: true },
    });
    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assignments = await prisma.cleanerAssignment.findMany({
      where: {
        propertyId,
        // Legacy rows without a profile remain visible. Once a profile is
        // present, it must belong to the property's owner; this prevents an
        // old cross-owner backfill link from exposing another owner's profile.
        OR: [
          { cleanerProfileId: null },
          { cleanerProfile: { ownerUserId: property.userId } },
        ],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      include: {
        cleaner: { select: { id: true, username: true } },
        cleanerProfile: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json(
      assignments.map((a) => ({
        id: a.id,
        propertyId: a.propertyId,
        // Legacy User-cleaner fields kept for the existing UI; null when
        // the assignment is profile-only.
        cleanerId: a.cleanerId,
        username: a.cleaner?.username ?? null,
        // RT-25.10 — profile-based fields. Either cleanerId or
        // cleanerProfileId (or both, post-backfill) is set.
        cleanerProfileId: a.cleanerProfileId,
        cleanerName: a.cleanerProfile?.name ?? a.cleaner?.username ?? null,
        cleanerPhone: a.cleanerProfile?.phone ?? null,
        priority: a.priority,
        createdAt: a.createdAt,
      }))
    );
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/cleaner-assignments
//   - body { propertyId, cleanerProfileId, priority? } — RT-25.10 profile-based assignment
//   - body { propertyId, username }                    — legacy User-cleaner assignment
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { propertyId, username, cleanerProfileId, priority } = body ?? {};

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId required" }, { status: 400 });
    }
    const propertyIdNum = Number(propertyId);
    if (!(await isPropertyOwner(propertyIdNum, session.userId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const priorityNum =
      typeof priority === "number" && Number.isInteger(priority) && priority >= 0
        ? priority
        : 0;

    // Profile-based assignment (RT-25.10)
    if (cleanerProfileId !== undefined && cleanerProfileId !== null) {
      const profileIdNum = Number(cleanerProfileId);
      if (Number.isNaN(profileIdNum)) {
        return NextResponse.json({ error: "Invalid cleanerProfileId" }, { status: 400 });
      }
      const profile = await prisma.cleaner.findUnique({
        where: { id: profileIdNum },
        select: { id: true, ownerUserId: true, name: true, phone: true },
      });
      if (!profile || profile.ownerUserId !== session.userId) {
        return NextResponse.json({ error: "Cleaner profile not found" }, { status: 404 });
      }

      const existing = await prisma.cleanerAssignment.findUnique({
        where: {
          cleanerProfileId_propertyId: {
            cleanerProfileId: profileIdNum,
            propertyId: propertyIdNum,
          },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "Already assigned" }, { status: 409 });
      }

      const assignment = await prisma.cleanerAssignment.create({
        data: {
          cleanerProfileId: profileIdNum,
          propertyId: propertyIdNum,
          priority: priorityNum,
        },
      });

      return NextResponse.json({
        id: assignment.id,
        propertyId: assignment.propertyId,
        cleanerId: null,
        username: null,
        cleanerProfileId: profile.id,
        cleanerName: profile.name,
        cleanerPhone: profile.phone,
        priority: assignment.priority,
        createdAt: assignment.createdAt,
      });
    }

    // Legacy username-based assignment
    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { error: "cleanerProfileId or username required" },
        { status: 400 }
      );
    }

    const cleaner = await prisma.user.findUnique({
      where: { username: username.trim() },
      select: { id: true, role: true, username: true },
    });
    if (!cleaner) {
      return NextResponse.json({ error: "Cleaner not found" }, { status: 404 });
    }
    if (cleaner.role !== "cleaner") {
      return NextResponse.json(
        { error: "User does not have the cleaner role" },
        { status: 400 }
      );
    }

    const existing = await prisma.cleanerAssignment.findUnique({
      where: {
        cleanerId_propertyId: {
          cleanerId: cleaner.id,
          propertyId: propertyIdNum,
        },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Already assigned" }, { status: 409 });
    }

    // A login-capable legacy cleaner can serve several owners. Reuse an
    // owner-correct profile already linked for this cleaner (preserving later
    // name/phone edits), otherwise reuse/create this owner's named profile.
    let cleanerProfile = await prisma.cleaner.findFirst({
      where: {
        ownerUserId: session.userId,
        assignments: {
          some: {
            cleanerId: cleaner.id,
            property: { userId: session.userId },
          },
        },
      },
      select: { id: true, name: true, phone: true },
      orderBy: { id: "asc" },
    });
    cleanerProfile ??= await prisma.cleaner.findFirst({
      where: { ownerUserId: session.userId, name: cleaner.username },
      select: { id: true, name: true, phone: true },
      orderBy: { id: "asc" },
    });
    cleanerProfile ??= await prisma.cleaner.create({
      data: {
        ownerUserId: session.userId,
        name: cleaner.username,
        phone: null,
      },
      select: { id: true, name: true, phone: true },
    });

    const assignment = await prisma.cleanerAssignment.create({
      data: {
        cleanerId: cleaner.id,
        cleanerProfileId: cleanerProfile.id,
        propertyId: propertyIdNum,
        priority: priorityNum,
      },
    });

    return NextResponse.json({
      id: assignment.id,
      propertyId: assignment.propertyId,
      cleanerId: assignment.cleanerId,
      username: cleaner.username,
      cleanerProfileId: cleanerProfile.id,
      cleanerName: cleanerProfile.name,
      cleanerPhone: cleanerProfile.phone,
      priority: assignment.priority,
      createdAt: assignment.createdAt,
    });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
