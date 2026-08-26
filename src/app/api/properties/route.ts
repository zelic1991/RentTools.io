import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { mintNewPropertyFeedIdentity } from "@/lib/feed-identity";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const include = {
      reservations: {
        orderBy: { checkIn: "asc" as const },
        include: { _count: { select: { guests: true } } },
      },
    };
    const orderBy = { createdAt: "desc" as const };
    const cleanerWhere = {
      cleanerAssignments: { some: { cleanerId: session.userId } },
    };
    const manageableWhere = {
      OR: [
        { userId: session.userId },
        { managers: { some: { managerId: session.userId } } },
      ],
    };

    // A cleaner needs timing/configuration metadata to compute operational
    // cleaning windows, but never property ownership/feed secrets or guest
    // contact/group data. Fetch only safe fields; do not fetch and redact.
    const cleanerSelect = {
      id: true,
      name: true,
      minNights: true,
      checkInTime: true,
      checkOutTime: true,
      bookingWindow: true,
      cleaningEnabled: true,
      reservations: {
        orderBy: { checkIn: "asc" as const },
        select: {
          id: true,
          propertyId: true,
          platform: true,
          checkIn: true,
          checkOut: true,
        },
      },
    };
    const forCleaner = <T extends { reservations: Array<Record<string, unknown>> }>(
      property: T,
    ) => ({
      ...property,
      // Preserve the existing cleaning-schedule shape without exposing the
      // reservation/guest name stored in Reservation.name.
      reservations: property.reservations.map((reservation) => ({
        ...reservation,
        name: "Guest",
      })),
    });
    const redactManagedFeedToken = <T extends { userId: number; feedToken?: unknown }>(
      property: T,
    ) => {
      if (property.userId === session.userId) return property;
      const safeProperty = { ...property };
      delete safeProperty.feedToken;
      return safeProperty;
    };

    // Backward-compatible: when neither page nor limit is supplied, return the full array.
    if (pageParam === null && limitParam === null) {
      if (session.role === "cleaner") {
        const properties = await prisma.property.findMany({
          where: cleanerWhere,
          orderBy,
          select: cleanerSelect,
        });
        return NextResponse.json(properties.map(forCleaner));
      }
      const properties = await prisma.property.findMany({
        where: manageableWhere,
        orderBy,
        include,
      });
      return NextResponse.json(properties.map(redactManagedFeedToken));
    }

    const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitParam ?? "20") || 20));
    const skip = (page - 1) * limit;

    if (session.role === "cleaner") {
      const [data, total] = await Promise.all([
        prisma.property.findMany({
          where: cleanerWhere,
          orderBy,
          select: cleanerSelect,
          skip,
          take: limit,
        }),
        prisma.property.count({ where: cleanerWhere }),
      ]);
      return NextResponse.json({ data: data.map(forCleaner), total, page, limit });
    }

    const [data, total] = await Promise.all([
      prisma.property.findMany({ where: manageableWhere, orderBy, include, skip, take: limit }),
      prisma.property.count({ where: manageableWhere }),
    ]);

    return NextResponse.json({
      data: data.map(redactManagedFeedToken),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "cleaner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const propertyName = name.trim();
    const feedIdentity = await mintNewPropertyFeedIdentity(propertyName);
    const property = await prisma.property.create({
      // minNights defaults to 1 — most hosts accept single-night stays;
      // those who want a floor raise it in Sync settings.
      data: {
        name: propertyName,
        userId: session.userId,
        minNights: 1,
        ...feedIdentity,
      },
    });
    await logAudit(session.userId, "create", "property", property.id, { name: property.name });
    return NextResponse.json(property);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
