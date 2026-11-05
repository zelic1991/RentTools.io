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
  /** The feed UID, given only to people who may name the stay. */
  sourceUid?: string | null;
}

export interface MobileDayOverride {
  date: string;
  type: "open" | "closed";
  /** Last day the host wants to keep a block for someone (YYYY-MM-DD). */
  holdUntil?: string | null;
}

export type MobileDayState =
  | { kind: "reservation"; reservation: MobileDayReservation }
  | { kind: "event"; platform: string; startDate: string; endDate: string; sourceUid: string | null }
  /** A run of blocked days around the tapped one, [from, to). */
  | { kind: "blocked"; from: string; to: string; holdUntil: string | null }
  | { kind: "forced-open" }
  /** A turnover buffer from the channel settings — drawn as unavailable
   *  in the grid, but the app still accepts a direct booking on it. */
  | { kind: "buffer" }
  /** A cleaning the host scheduled. Blocking the day would replace it,
   *  and unlike a cleaning a block travels to Airbnb and Booking. */
  | { kind: "cleaning" }
  | { kind: "free" };

export type MobileDayAction =
  | "create"
  | "block"
  | "unblock"
  | "unblockAll"
  | "hold"
  | "claim"
  | "edit"
  | "delete";

function day(value: string): string {
  return value.slice(0, 10);
}

function shiftDay(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * The run of consecutive blocked days the tapped day belongs to, as
 * [from, to). A block entered day by day is still one block to the host.
 */
export function blockRunAround(
  date: string,
  overrides: MobileDayOverride[],
): { from: string; to: string; holdUntil: string | null } {
  const closed = new Map(
    overrides
      .filter((row) => row.type === "closed")
      .map((row) => [day(row.date), row.holdUntil ?? null] as const),
  );
  let from = date;
  while (closed.has(shiftDay(from, -1))) from = shiftDay(from, -1);
  let to = shiftDay(date, 1);
  while (closed.has(to)) to = shiftDay(to, 1);
  let holdUntil: string | null = null;
  for (let d = from; d < to; d = shiftDay(d, 1)) {
    const hold = closed.get(d) ?? null;
    if (hold && (!holdUntil || hold > holdUntil)) holdUntil = hold;
  }
  return { from, to, holdUntil };
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
    /** Days with a scheduled cleaning. They are filtered out of the
     *  phone's availability data on purpose — but a day the host cannot
     *  see is a day the host can destroy. */
    cleaningDates?: Iterable<string>;
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
      sourceUid: event.sourceUid ?? null,
    };
  }

  // An explicit override is a decision someone made; a buffer is
  // computed from the channel settings, so the decision wins.
  const override = input.overrides.find((row) => day(row.date) === date);
  if (override?.type === "closed") {
    return { kind: "blocked", ...blockRunAround(date, input.overrides) };
  }
  if (override?.type === "open") return { kind: "forced-open" };

  if (input.cleaningDates) {
    for (const cleaning of input.cleaningDates) {
      if (day(cleaning) === date) return { kind: "cleaning" };
    }
  }

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
    // Naming it, with amount and party size, stays inside RentTools.
    case "event":
      return state.sourceUid ? ["claim"] : [];
    case "blocked":
      return shiftDay(state.from, 1) < state.to
        ? ["unblockAll", "unblock", "hold", "create"]
        : ["unblock", "hold", "create"];
    // The server accepts a direct booking on a buffer day, so offering it
    // is honest; the sheet explains what the buffer still does.
    case "buffer":
      return ["create", "block"];
    // No block here. The override table holds one row per day, so
    // blocking would silently replace the cleaning — and a block, unlike
    // a cleaning, is exported to the portals. A booking is safe: the
    // create path leaves cleaning rows alone.
    case "cleaning":
      return ["create"];
    default:
      return ["create", "block"];
  }
}
