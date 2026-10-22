/**
 * Guest count shown in reservation lists. The confirmed traveler count
 * (bookedGuestCount) wins, because iCal-imported bookings never carry
 * passport guests until the pre-arrival form is filled in; otherwise fall
 * back to the number of stored passport guests. Mirrors
 * reservationGuestCount in mobile-operations-core.
 */
export function displayGuestCount(reservation: {
  bookedGuestCount?: number | null;
  _count?: { guests: number };
}): number {
  if (reservation.bookedGuestCount && reservation.bookedGuestCount > 0) {
    return reservation.bookedGuestCount;
  }
  return reservation._count?.guests ?? 0;
}
