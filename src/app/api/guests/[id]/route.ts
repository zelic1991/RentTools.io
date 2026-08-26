import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripSpaces, sanitizeAlphanumeric, normalizePhone } from "@/lib/sanitize";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageProperty } from "@/lib/ownership";

const ALLOWED_STRING_FIELDS = [
  "fullName",
  "firstName",
  "lastName",
  "country",
  "citizenshipCode",
  "dateOfBirth",
  "gender",
  "dateOfIssue",
  "expiryDate",
  "passportNumber",
  "issuedBy",
  "visaNumber",
  "visaFrom",
  "visaTo",
  // RT-25.12 — per-guest free-text notes; preserves whitespace and
  // newlines so a paragraph from the host's clipboard round-trips.
  "notes",
] as const;

async function loadManageableGuest(guestId: number, userId: number, role: string) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      reservationId: true,
      reservation: { select: { propertyId: true } },
    },
  });
  if (!guest) return null;
  if (!(await canManageProperty(guest.reservation.propertyId, userId, role))) return null;
  return guest;
}

async function validParentChain(
  parentId: number,
  guestId: number,
  reservationId: number,
): Promise<boolean> {
  const seen = new Set<number>([guestId]);
  let currentId: number | null = parentId;

  // A reservation should never approach this depth. The bound keeps a
  // corrupted legacy chain from turning one PATCH into an unbounded DB walk.
  for (let depth = 0; currentId !== null && depth < 100; depth++) {
    if (seen.has(currentId)) return false;
    seen.add(currentId);

    const current: {
      id: number;
      reservationId: number;
      parentId: number | null;
    } | null = await prisma.guest.findUnique({
      where: { id: currentId },
      select: { id: true, reservationId: true, parentId: true },
    });
    if (!current || current.reservationId !== reservationId) return false;
    currentId = current.parentId;
  }

  return currentId === null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.impersonatorId) {
      return NextResponse.json({ error: "Impersonation is read-only" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseInt(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const owned = await loadManageableGuest(numId, session.userId, session.role);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if ("parentId" in body) {
      if (body.parentId === null) {
        data.parentId = null;
      } else if (
        !Number.isInteger(body.parentId) ||
        body.parentId <= 0 ||
        !(await validParentChain(body.parentId, numId, owned.reservationId))
      ) {
        return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
      } else {
        data.parentId = body.parentId;
      }
    }

    for (const key of ALLOWED_STRING_FIELDS) {
      if (key in body && typeof body[key] === "string") {
        let value = body[key] as string;
        if (key === "passportNumber") value = stripSpaces(value);
        else if (key === "issuedBy") value = sanitizeAlphanumeric(value);
        data[key] = value;
      }
    }

    // RT-25.13 — phone is sanitised separately so we can return a 400 on
    // malformed input rather than silently storing garbage.
    if ("phone" in body && typeof body.phone === "string") {
      try {
        data.phone = normalizePhone(body.phone);
      } catch {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      }
    }

    if ("yearsOld" in body && typeof body.yearsOld === "number") {
      data.yearsOld = body.yearsOld;
    }
    if ("hasVisa" in body && typeof body.hasVisa === "boolean") {
      data.hasVisa = body.hasVisa;
    }

    const guest = await prisma.guest.update({
      where: { id: numId },
      data,
    });
    // Audit the mutation shape, never the guest values. Names, phone numbers,
    // free-text notes and travel-document details belong only in the guest
    // record / encrypted pre-check-in payload, not a second plaintext store.
    await logAudit(
      session.userId,
      "update",
      "guest",
      numId,
      { changedFields: Object.keys(data).sort() },
    );
    return NextResponse.json(guest);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.impersonatorId) {
      return NextResponse.json({ error: "Impersonation is read-only" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseInt(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const owned = await loadManageableGuest(numId, session.userId, session.role);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.guest.delete({ where: { id: numId } });
    await logAudit(session.userId, "delete", "guest", numId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
