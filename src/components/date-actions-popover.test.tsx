import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarDatePopover } from "./calendar/calendar-date-popover";
import type { CalendarBar } from "./calendar/types";
import type { Reservation } from "@/lib/types";

const guestA: CalendarBar = {
  name: "Guest A",
  platform: "direct",
  startDate: "2026-11-08",
  endDate: "2026-11-09",
  reservationId: 1,
};

const reservationA: Reservation = {
  id: 1,
  name: "Guest A",
  checkIn: "2026-11-08",
  checkOut: "2026-11-09",
  platform: "direct",
  propertyId: 1,
  createdAt: "2026-08-26T00:00:00.000Z",
};

function renderPopover(
  bars: CalendarBar[] = [guestA],
  reservations: Reservation[] = [reservationA],
  selectedDates: string[] = ["2026-11-09"],
) {
  return renderToStaticMarkup(
    <CalendarDatePopover
      selectedDates={new Set(selectedDates)}
      bars={bars}
      bufferDates={new Set()}
      potentialDates={new Set()}
      sameDayCleaningDates={new Set()}
      unbookableDates={new Set()}
      openOverrides={new Set()}
      closedOverrides={new Set()}
      cleaningOverrides={new Set()}
      syncedEvents={[]}
      reservations={reservations}
      cleaningEnabled={false}
      bufferBefore={0}
      onClose={vi.fn()}
      onToggleDate={vi.fn()}
      onSetSingleOverride={vi.fn()}
      onRemoveSingleOverride={vi.fn()}
      onSetBulkOverride={vi.fn()}
      onRemoveBulkOverride={vi.fn()}
      onExtendBooking={vi.fn(async () => ({ ok: true as const }))}
      onCreateReservation={vi.fn()}
    />
  );
}

describe("DateActionsPopover same-day turnover", () => {
  it("offers a separate reservation on another guest's checkout date", () => {
    const markup = renderPopover();

    expect(markup).toContain("Guest A");
    expect(markup).toContain("checking out");
    expect(markup).toContain("Free");
    expect(markup).toContain("Extend reservation");
    expect(markup).toContain("Create reservation");
    expect(markup).not.toContain("Schedule cleaning");
  });

  it("does not render a cleaning workflow between back-to-back guests when cleaning is disabled", () => {
    const guestB: CalendarBar = {
      name: "Guest B",
      platform: "direct",
      startDate: "2026-11-09",
      endDate: "2026-11-10",
      reservationId: 2,
    };
    const reservationB: Reservation = {
      ...reservationA,
      id: 2,
      name: "Guest B",
      checkIn: "2026-11-09",
      checkOut: "2026-11-10",
    };

    const markup = renderPopover([guestA, guestB], [reservationA, reservationB]);

    expect(markup).toContain("checking out");
    expect(markup).toContain("checking in");
    expect(markup).not.toContain("Schedule cleaning");
    expect(markup).not.toContain("Cleaning required");
    expect(markup).not.toContain("between stays");
  });

  it("does not offer bulk cleaning actions when cleaning is disabled", () => {
    const markup = renderPopover([], [], ["2026-11-09", "2026-11-10"]);

    expect(markup).toContain("Create reservation");
    expect(markup).toContain("Block all (2)");
    expect(markup).not.toContain("Schedule cleaning");
  });
});
