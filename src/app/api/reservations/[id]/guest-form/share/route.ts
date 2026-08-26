import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageProperty } from "@/lib/ownership";
import {
  decryptGuestData,
  encryptGuestData,
  guestDataEncryptionReady,
  hashShareToken,
  maskDocumentNumber,
} from "@/lib/precheckin-crypto";
import {
  decryptOwnerShareToken,
  guestFormExpiry,
  mintGuestFormToken,
} from "@/lib/guest-form-security";
import {
  nextPrecheckinHandoffStatus,
  precheckinWarnings,
  type PrecheckinHandoffAction,
  type PrecheckinPayload,
} from "@/lib/precheckin";
import { validatedPrecheckinHandoffPayload } from "@/lib/precheckin-handoff";

// RT-25.2 — find-or-create a GuestFormSubmission for this reservation
// against the property's first GuestFormTemplate. Returns the share
// token + relative public URL the host can copy and send to the guest.
// Idempotent: re-POSTing returns the same submission (and same token)
// rather than creating duplicates, so the UI can call this every time
// the host clicks "send pre-arrival form".

interface AnswerOut {
  fieldId: string;
  type: string;
  label: string;
  value: unknown;
}

// Read-only — return current submission state (or null) without
// creating one. Used by reservation-view to know whether to show
// "Not sent" / "Awaiting" / submitted-answers panel.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.impersonatorId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { id } = await params;
    const numId = parseInt(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const reservation = await prisma.reservation.findUnique({
      where: { id: numId },
      select: { id: true, propertyId: true },
    });
    if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canManageProperty(reservation.propertyId, session.userId, session.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const submission = await prisma.guestFormSubmission.findFirst({
      where: { reservationId: numId },
      orderBy: { createdAt: "asc" },
    });
    if (!submission) return NextResponse.json({ submission: null });

    let answers: AnswerOut[] = [];
    try {
      const parsed = JSON.parse(submission.answers);
      if (Array.isArray(parsed)) answers = parsed as AnswerOut[];
    } catch {
      // malformed JSON — treat as empty
    }

    let securePayload: PrecheckinPayload | null = null;
    if (submission.securePayload) {
      try {
        securePayload = decryptGuestData<PrecheckinPayload>(submission.securePayload);
      } catch {
        // Fail closed: a missing/wrong key must never fall back to plaintext.
      }
    }
    const rawToken = decryptOwnerShareToken(submission.tokenCiphertext);

    return NextResponse.json({
      submission: {
        shareUrl: rawToken
          ? `/g/${rawToken}`
          : submission.tokenHash
            ? null
            : `/g/${submission.shareToken}`,
        sentAt: submission.createdAt,
        submittedAt: submission.submittedAt,
        status: submission.status,
        expiresAt: submission.expiresAt,
        revokedAt: submission.revokedAt,
        ownerApprovedAt: submission.ownerApprovedAt,
        lastChangedAt: submission.lastChangedAt,
        travelerCount: securePayload?.travelers.length ?? 0,
        warnings: securePayload ? precheckinWarnings(securePayload) : [],
        travelers: securePayload?.travelers.map((traveler) => ({
          clientId: traveler.clientId,
          isLead: traveler.isLead,
          firstName: traveler.firstName,
          lastName: traveler.lastName,
          dateOfBirth: traveler.dateOfBirth,
          gender: traveler.gender,
          citizenshipCountry: traveler.citizenshipCountry,
          birthCountry: traveler.birthCountry,
          birthPlace: traveler.birthPlace,
          residenceCountry: traveler.residenceCountry,
          residencePlace: traveler.residencePlace,
          residenceAddress: traveler.residenceAddress,
          documentType: traveler.documentType,
          documentNumberMasked: maskDocumentNumber(traveler.documentNumber),
          borderEntryDate: traveler.borderEntryDate,
          borderEntryPlace: traveler.borderEntryPlace,
          borderEntryPoint: traveler.borderEntryPoint,
          taxCategorySuggestion: traveler.taxCategorySuggestion,
        })) ?? [],
        answers: submission.submittedAt
          ? securePayload?.customAnswers ?? answers
          : [],
      },
    });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.impersonatorId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { id } = await params;
    const numId = parseInt(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const reservation = await prisma.reservation.findUnique({
      where: { id: numId },
      select: {
        id: true,
        propertyId: true,
        checkOut: true,
        bookedGuestCount: true,
        property: { select: { feedToken: true } },
      },
    });
    if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canManageProperty(reservation.propertyId, session.userId, session.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const template = await prisma.guestFormTemplate.findFirst({
      where: { propertyId: reservation.propertyId },
      orderBy: { createdAt: "asc" },
    });
    if (!template) {
      return NextResponse.json(
        { error: "No guest-form template configured for this property" },
        { status: 400 }
      );
    }

    if (!reservation.property.feedToken) {
      return NextResponse.json(
        { error: "Protect the property's public calendar feeds before collecting identity data" },
        { status: 409 },
      );
    }

    if (!reservation.bookedGuestCount) {
      return NextResponse.json(
        { error: "Set the confirmed traveler count before generating the guest link" },
        { status: 409 },
      );
    }

    if (!guestDataEncryptionReady()) {
      return NextResponse.json(
        { error: "Secure guest-data storage is not configured" },
        { status: 503 },
      );
    }

    const existing = await prisma.guestFormSubmission.findFirst({
      where: { reservationId: numId, templateId: template.id },
      orderBy: { createdAt: "asc" },
    });

    if (existing && !existing.revokedAt && (!existing.expiresAt || existing.expiresAt > new Date())) {
      const existingToken = decryptOwnerShareToken(existing.tokenCiphertext);
      if (existingToken) {
        return NextResponse.json({
          shareUrl: `/g/${existingToken}`,
          submittedAt: existing.submittedAt,
          status: existing.status,
          expiresAt: existing.expiresAt,
        });
      }
    }

    const rawToken = mintGuestFormToken();
    const tokenHash = hashShareToken(rawToken);
    const tokenCiphertext = encryptGuestData({ token: rawToken });
    const expiresAt = guestFormExpiry(reservation.checkOut);
    const submission = existing
      ? await prisma.guestFormSubmission.update({
          where: { id: existing.id },
          data: {
            shareToken: `hashed:${tokenHash}`,
            tokenHash,
            tokenCiphertext,
            status: "PENDING",
            expiresAt,
            revokedAt: null,
            securePayload: "",
            answers: "[]",
            submittedAt: null,
            ownerApprovedAt: null,
            lastChangedAt: new Date(),
            updatedAt: new Date(),
          },
        })
      : await prisma.guestFormSubmission.create({
        data: {
          reservationId: numId,
          templateId: template.id,
          shareToken: `hashed:${tokenHash}`,
          tokenHash,
          tokenCiphertext,
          status: "PENDING",
          expiresAt,
          lastChangedAt: new Date(),
        },
      });

    return NextResponse.json({
      shareUrl: `/g/${rawToken}`,
      submittedAt: submission.submittedAt,
      status: submission.status,
      expiresAt: submission.expiresAt,
    });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.impersonatorId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { id } = await params;
    const reservationId = Number(id);
    if (!Number.isInteger(reservationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        propertyId: true,
        checkIn: true,
        checkOut: true,
        bookedGuestCount: true,
      },
    });
    if (!reservation || !(await canManageProperty(reservation.propertyId, session.userId, session.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const submission = await prisma.guestFormSubmission.findFirst({
      where: { reservationId },
      orderBy: { createdAt: "asc" },
    });
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action === "revoke") {
      await prisma.guestFormSubmission.update({
        where: { id: submission.id },
        data: { status: "REVOKED", revokedAt: new Date(), tokenCiphertext: null, lastChangedAt: new Date(), updatedAt: new Date() },
      });
      return NextResponse.json({ status: "REVOKED" });
    }
    if (
      action === "start-review" ||
      action === "approve" ||
      action === "mark-evisitor-ready" ||
      action === "confirm-evisitor-manual"
    ) {
      const nextStatus = nextPrecheckinHandoffStatus(submission.status, action);
      if (!nextStatus) {
        return NextResponse.json({ error: "Invalid status transition" }, { status: 409 });
      }
      if (!submission.securePayload) {
        return NextResponse.json({ error: "Completed traveler data is required" }, { status: 409 });
      }
      if (
        action === "mark-evisitor-ready" &&
        !validatedPrecheckinHandoffPayload(submission.securePayload, reservation)
      ) {
        return NextResponse.json(
          { error: "Traveler data no longer matches the reservation" },
          { status: 409 },
        );
      }

      const changedAt = new Date();
      const updateData = {
        status: nextStatus,
        ...(action === "approve" ? { ownerApprovedAt: changedAt } : {}),
        lastChangedAt: changedAt,
        updatedAt: changedAt,
      };
      await prisma.$transaction([
        prisma.guestFormSubmission.update({
          // Including the source status prevents a concurrent request from
          // replaying or skipping a transition after this read.
          where: { id: submission.id, status: submission.status },
          data: updateData,
        }),
        prisma.auditLog.create({
          data: {
            userId: session.userId,
            action: "update",
            resourceType: "guest",
            resourceId: submission.id,
            payload: JSON.stringify({
              transition: action as PrecheckinHandoffAction,
              fromStatus: submission.status,
              toStatus: nextStatus,
              reservationId,
            }),
            createdAt: changedAt,
          },
        }),
      ]);
      return NextResponse.json({ status: nextStatus });
    }
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 409 });
    }
    console.error("Route error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
