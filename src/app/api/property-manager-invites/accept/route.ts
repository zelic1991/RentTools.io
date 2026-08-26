import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/property-manager-invites/accept
// Body: { token }
// Auth required. Idempotent: accepting your own already-used invite returns the same property.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const token = String(body.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    let invite = await prisma.propertyManagerInvite.findUnique({
      where: { token },
      include: {
        property: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.revokedAt) {
      return NextResponse.json({ error: "Invite has been revoked" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    // Owner can't accept their own invite
    if (invite.property.userId === session.userId) {
      return NextResponse.json(
        { error: "You already own this property" },
        { status: 400 }
      );
    }

    let claimedNow = false;
    if (invite.acceptedById === null) {
      // The invite token is an authority capability. Claim it with one
      // compare-and-set write so two users racing the same token cannot both
      // pass a read-then-create sequence. Revocation and expiry are part of
      // the same predicate and therefore fail closed at the claim boundary.
      const claimed = await prisma.propertyManagerInvite.updateMany({
        where: {
          id: invite.id,
          acceptedById: null,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedById: session.userId, acceptedAt: new Date() },
      });
      claimedNow = claimed.count === 1;

      // Always reload after the CAS. On a lost race this identifies the one
      // recorded accepter; on a same-user retry it also repairs a historical
      // or crash-interrupted claim whose manager row is still missing.
      const current = await prisma.propertyManagerInvite.findUnique({
        where: { token },
        include: {
          property: { select: { id: true, name: true, userId: true } },
        },
      });
      if (!current) {
        return NextResponse.json({ error: "Invite not found" }, { status: 404 });
      }
      invite = current;
    }

    // Re-check mutable gates after the CAS/reload. A revoked or expired invite
    // never becomes idempotently usable merely because it has acceptedById.
    if (invite.revokedAt) {
      return NextResponse.json({ error: "Invite has been revoked" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }
    if (invite.acceptedById !== session.userId) {
      return NextResponse.json(
        { error: "Invite has already been used by another user" },
        { status: 410 }
      );
    }

    const existing = await prisma.propertyManager.findUnique({
      where: {
        managerId_propertyId: {
          managerId: session.userId,
          propertyId: invite.propertyId,
        },
      },
      select: { id: true },
    });

    // Upsert is deliberate even for an already-recorded accepter: if the
    // process died after the CAS but before manager creation, their retry
    // repairs the missing grant. The composite unique key keeps retries safe.
    await prisma.propertyManager.upsert({
      where: {
        managerId_propertyId: {
          managerId: session.userId,
          propertyId: invite.propertyId,
        },
      },
      update: { accessLevel: invite.accessLevel },
      create: {
        propertyId: invite.propertyId,
        managerId: session.userId,
        grantedById: invite.createdById,
        accessLevel: invite.accessLevel,
      },
    });


    if (claimedNow || !existing) {
      await logAudit(session.userId, "create", "manager", invite.id, {
        action: claimedNow ? "invite_accepted" : "invite_acceptance_recovered",
        propertyId: invite.propertyId,
      });
    }

    return NextResponse.json({
      action: claimedNow ? "accepted" : "already_accepted",
      propertyId: invite.propertyId,
      propertyName: invite.property.name,
      accessLevel: invite.accessLevel,
    });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/property-manager-invites/accept?token=X — preview an invite (auth required)
// Returns property name + owner so the user knows what they're accepting
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const invite = await prisma.propertyManagerInvite.findUnique({
      where: { token },
      include: {
        property: { select: { id: true, name: true } },
        createdBy: { select: { username: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ status: "not_found" });
    }
    if (invite.revokedAt) {
      return NextResponse.json({ status: "revoked" });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ status: "expired" });
    }
    if (invite.acceptedById && invite.acceptedById !== session.userId) {
      return NextResponse.json({ status: "used" });
    }

    return NextResponse.json({
      status: invite.acceptedById === session.userId ? "already_accepted" : "valid",
      propertyId: invite.propertyId,
      propertyName: invite.property.name,
      invitedBy: invite.createdBy.username,
      expiresAt: invite.expiresAt,
      accessLevel: invite.accessLevel,
    });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
