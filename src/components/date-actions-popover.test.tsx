import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarDatePopover } from "./calendar/calendar-date-popover";

describe("DateActionsPopover same-day turnover", () => {
  it("offers a separate reservation on another guest's checkout date", () => {
    const markup = renderToStaticMarkup(
      <CalendarDatePopover
        selectedDates={new Set(["2026-11-09"])}
        bars={[
          {
            name: "Guest A",
            platform: "direct",
            startDate: "2026-11-08",
            endDate: "2026-11-09",
            reservationId: 1,
          },
        ]}
        bufferDates={new Set()}
        potentialDates={new Set()}
        sameDayCleaningDates={new Set()}
        unbookableDates={new Set()}
        openOverrides={new Set()}
        closedOverrides={new Set()}
        cleaningOverrides={new Set()}
        syncedEvents={[]}
        reservations={[
          {
            id: 1,
            name: "Guest A",
            checkIn: "2026-11-08",
            checkOut: "2026-11-09",
            platform: "direct",
            propertyId: 1,
            createdAt: "2026-08-26T00:00:00.000Z",
          },
        ]}
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

    expect(markup).toContain("Guest A");
    expect(markup).toContain("checking out");
    expect(markup).toContain("Free");
    expect(markup).toContain("Extend reservation");
    expect(markup).toContain("Create reservation");
  });
});
