/**
 * What a single day on the phone calendar *is*, and what may be done to it.
 *
 * The desktop popover resolves this inline across a thousand lines of
 * bulk-selection and cleaning-workflow rules. The phone needs the small
 * subset a host uses while standing in the apartment — book, block,
 * correct — so the rules live here as data, testable without a DOM.
 */

export interface MobileDayReservation {
  id: number;
  name: string;
  /** ISO date or datetime; only the first ten characters are read. */
  checkIn: string;
  checkOut: string;
  platform: string;
}

export interface MobileDayEvent {
  platform: string;
  startDate: string;
  endDate: string;
}

export interface MobileDayOverride {
  date: string;
  type: "open" | "closed";
}

export type MobileDayState =
  | { kind: "reservation"; reservation: MobileDayReservation }
  | { kind: "event"; platform: string; startDate: string; endDate: string }
  | { kind: "blocked" }
  | { kind: "forced-open" }
  /** A turnover buffer from the channel settings — drawn as unavailable
   *  in the grid, but the app still accepts a direct booking on it. */
  | { kind: "buffer" }
  | { kind: "free" };

export type MobileDayAction = "create" | "block" | "unblock" | "edit" | "delete";

function day(value: string): string {
  return value.slice(0, 10);
}

/** Half-open: the checkout day is free again for the next arrival. */
function covers(from: string, to: string, date: string): boolean {
  return day(from) <= date && day(to) > date;
}

export function resolveMobileDay(
  date: string,
  input: {
    reservations: MobileDayReservation[];
    events: MobileDayEvent[];
    overrides: MobileDayOverride[];
    /** Buffer days the grid paints as unavailable. Without them the
     *  sheet would call a struck-through day "frei". */
    bufferDates?: Iterable<string>;
  },
): MobileDayState {
  const reservation = input.reservations.find((row) =>
    covers(row.checkIn, row.checkOut, date),
  );
  if (reservation) return { kind: "reservation", reservation };

  // An imported event that nobody claimed is still a real stay on the
  // other platform: showable, not editable from here.
  const event = input.events.find((row) => covers(row.startDate, row.endDate, date));
  if (event) {
    return {
      kind: "event",
      platform: event.platform,
      startDate: day(event.startDate),
      endDate: day(event.endDate),
    };
  }

  // An explicit override is a decision someone made; a buffer is
  // computed from the channel settings, so the decision wins.
  const override = input.overrides.find((row) => day(row.date) === date);
  if (override?.type === "closed") return { kind: "blocked" };
  if (override?.type === "open") return { kind: "forced-open" };

  if (input.bufferDates) {
    for (const buffer of input.bufferDates) {
      if (day(buffer) === date) return { kind: "buffer" };
    }
  }
  return { kind: "free" };
}

export function mobileDayActions(
  state: MobileDayState,
  canWrite: boolean,
): MobileDayAction[] {
  if (!canWrite) return [];
  switch (state.kind) {
    case "reservation":
      return ["edit", "delete"];
    // Changing a platform booking belongs on that platform; offering it
    // here would promise a write the app cannot make.
    case "event":
      return [];
    case "blocked":
      return ["unblock", "create"];
    // The server accepts a direct booking on a buffer day, so offering it
    // is honest; the sheet explains what the buffer still does.
    case "buffer":
      return ["create", "block"];
    default:
      return ["create", "block"];
  }
}
