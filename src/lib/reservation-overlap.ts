/**
 * Finds a stored reservation that shares at least one night with
 * [checkIn, checkOut). Stays are compared as calendar days, so a guest who
 * leaves on the 4th never blocks one who arrives on the 4th.
 *
 * The database is only asked for a widened window; the exact test runs here.
 * Comparing DateTime values inside SQLite turned a same-day changeover into
 * a 409 for a row stored in an older format: "Iryna leaves 4 July" refused
 * "Istvan arrives 4 July".
 */

type OverlapRow = { id: number; name: string; checkIn: Date; checkOut: Date };

interface ReservationFinder {
  reservation: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true; name: true; checkIn: true; checkOut: true };
    }): Promise<OverlapRow[]>;
  };
}

const DAY_MS = 86_400_000;

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Pure check on calendar days, half-open: the checkout day is free. */
export function staysShareANight(
  a: { checkIn: Date; checkOut: Date },
  b: { checkIn: Date; checkOut: Date },
): boolean {
  return day(a.checkIn) < day(b.checkOut) && day(b.checkIn) < day(a.checkOut);
}

export async function findOverlappingReservation(
  db: ReservationFinder,
  input: { propertyId: number; checkIn: Date; checkOut: Date; excludeId?: number },
): Promise<OverlapRow | null> {
  const rows = await db.reservation.findMany({
    where: {
      propertyId: input.propertyId,
      ...(input.excludeId !== undefined ? { id: { not: input.excludeId } } : {}),
      // One day of slack on each side; the exact day test is below.
      checkIn: { lt: new Date(input.checkOut.getTime() + DAY_MS) },
      checkOut: { gt: new Date(input.checkIn.getTime() - DAY_MS) },
    },
    select: { id: true, name: true, checkIn: true, checkOut: true },
  });
  return (
    rows.find(
      (row) => row.id !== input.excludeId && staysShareANight(row, input),
    ) ?? null
  );
}
