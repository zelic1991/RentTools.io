import { decryptGuestData } from "@/lib/precheckin-crypto";
import {
  precheckinWarnings,
  validatePrecheckinPayload,
  type PrecheckinPayload,
} from "@/lib/precheckin";

export interface PrecheckinReservationBoundary {
  checkIn: Date;
  checkOut: Date;
  bookedGuestCount: number | null;
}

function reservationDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Re-decrypt and validate the canonical identity payload against the current
 * reservation before it can enter or be shown in the manual eVisitor handoff.
 * No plaintext fallback is permitted when decryption or validation fails.
 */
export function validatedPrecheckinHandoffPayload(
  securePayload: string,
  reservation: PrecheckinReservationBoundary,
): PrecheckinPayload | null {
  if (
    !securePayload ||
    !Number.isInteger(reservation.bookedGuestCount) ||
    (reservation.bookedGuestCount ?? 0) < 1
  ) {
    return null;
  }

  try {
    const decrypted = decryptGuestData<PrecheckinPayload>(securePayload);
    const validation = validatePrecheckinPayload(decrypted, {
      checkIn: reservationDate(reservation.checkIn),
      checkOut: reservationDate(reservation.checkOut),
      maxTravelers: reservation.bookedGuestCount,
    });
    if (!validation.ok || !validation.payload) return null;
    if (validation.payload.travelers.length !== reservation.bookedGuestCount) {
      return null;
    }
    // The public form may be submitted with review warnings so an owner can
    // help the guest correct them. EVISITOR_READY is a stricter boundary:
    // every field the existing payload builder marks as required must exist.
    if (precheckinWarnings(validation.payload).length > 0) return null;
    return validation.payload;
  } catch {
    return null;
  }
}
