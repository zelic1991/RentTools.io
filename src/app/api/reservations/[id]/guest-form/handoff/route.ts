import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageProperty } from "@/lib/ownership";
import { validatedPrecheckinHandoffPayload } from "@/lib/precheckin-handoff";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

/**
 * Protected plaintext handoff for manual entry into eVisitor. This endpoint
 * performs no eVisitor network action and returns no official lookup codes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return noStoreJson({ error: "Unauthorized" }, 401);
    if (session.impersonatorId) return noStoreJson({ error: "Not found" }, 404);

    const { id } = await params;
    const reservationId = Number(id);
    if (!Number.isInteger(reservationId)) {
      return noStoreJson({ error: "Invalid ID" }, 400);
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        propertyId: true,
        checkIn: true,
        checkOut: true,
        bookedGuestCount: true,
      },
    });
    if (
      !reservation ||
      !(await canManageProperty(
        reservation.propertyId,
        session.userId,
        session.role,
      ))
    ) {
      return noStoreJson({ error: "Not found" }, 404);
    }

    const submission = await prisma.guestFormSubmission.findFirst({
      where: { reservationId },
      orderBy: { createdAt: "asc" },
    });
    if (
      !submission ||
      !["EVISITOR_READY", "EVISITOR_CONFIRMED_MANUAL"].includes(
        submission.status,
      )
    ) {
      return noStoreJson({ error: "Manual handoff is not ready" }, 409);
    }

    const payload = validatedPrecheckinHandoffPayload(
      submission.securePayload,
      reservation,
    );
    if (!payload) {
      return noStoreJson(
        { error: "Traveler data no longer matches the reservation" },
        409,
      );
    }

    return noStoreJson({
      submissionId: submission.id,
      reservationId,
      status: submission.status,
      stay: {
        checkIn: reservation.checkIn.toISOString().slice(0, 10),
        checkOut: reservation.checkOut.toISOString().slice(0, 10),
        bookedGuestCount: reservation.bookedGuestCount,
        expectedArrivalTime: payload.expectedArrivalTime,
        arrivalOrganization: payload.arrivalOrganization,
        serviceType: payload.serviceType,
      },
      travelers: payload.travelers.map((traveler) => ({
        guestId: traveler.guestId,
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
        documentNumber: traveler.documentNumber,
        borderEntryDate: traveler.borderEntryDate,
        borderEntryPlace: traveler.borderEntryPlace,
        borderEntryPoint: traveler.borderEntryPoint,
        taxCategorySuggestion: traveler.taxCategorySuggestion,
      })),
    });
  } catch (error) {
    console.error(
      "Manual eVisitor handoff failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return noStoreJson({ error: "Internal server error" }, 500);
  }
}
