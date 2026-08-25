"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { useCalendarData } from "@/components/calendar/use-calendar-data";
import type { MobileOperationsData } from "@/lib/mobile-operations";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_FORMAT = new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric", timeZone: "UTC" });
const NO_DATES = new Set<string>();

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function MobileCalendar({ data }: { data: MobileOperationsData }) {
  const [year, initialMonth] = data.today.split("-").map(Number);
  const [active, setActive] = useState({ year, month: initialMonth - 1 });
  const computed = useCalendarData(
    data.calendar.property,
    data.calendar.events,
    data.calendar.links,
    data.calendar.overrides,
  );
  const minMonth = data.calendar.visibleFrom.slice(0, 7);
  const maxMonth = data.calendar.visibleUntil.slice(0, 7);
  const activeKey = monthKey(active.year, active.month);
  const todayDate = useMemo(() => new Date(`${data.today}T12:00:00.000Z`), [data.today]);
  const monthStart = `${activeKey}-01`;
  const nextMonth = new Date(Date.UTC(active.year, active.month + 1, 1));
  const monthEnd = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const monthReservations = data.calendar.property.reservations.filter(
    (reservation) => reservation.checkIn.slice(0, 10) < monthEnd
      && reservation.checkOut.slice(0, 10) > monthStart,
  );

  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(active.year, active.month + delta, 1));
    const nextValue = { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    const key = monthKey(nextValue.year, nextValue.month);
    if (key >= minMonth && key <= maxMonth) setActive(nextValue);
  };

  return (
    <section aria-labelledby="mobile-calendar-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Kalender</p>
          <h2 id="mobile-calendar-heading" className="mt-1 text-2xl font-semibold tracking-tight">Frei oder belegt</h2>
        </div>
        <button
          type="button"
          onClick={() => setActive({ year, month: initialMonth - 1 })}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <RotateCcw aria-hidden className="h-4 w-4" /> Heute
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-h-14 items-center justify-between border-b border-slate-200 px-2 dark:border-slate-800 sm:px-4">
          <button
            type="button"
            aria-label="Vorheriger Monat"
            onClick={() => moveMonth(-1)}
            disabled={activeKey <= minMonth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-base font-semibold capitalize">
            <CalendarDays aria-hidden className="h-4 w-4 text-rose-600" />
            {MONTH_FORMAT.format(new Date(Date.UTC(active.year, active.month, 1)))}
          </div>
          <button
            type="button"
            aria-label="Nächster Monat"
            onClick={() => moveMonth(1)}
            disabled={activeKey >= maxMonth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            <ChevronRight aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-slate-200 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 sm:px-2">
          {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="overflow-hidden px-1 pb-2 pt-1 sm:px-2">
          <CalendarGrid
            readOnly
            year={active.year}
            month={active.month}
            today={todayDate}
            visibleFrom={data.calendar.visibleFrom}
            visibleUntil={data.calendar.visibleUntil}
            minNights={data.calendar.property.minNights}
            checkInTime={data.calendar.property.checkInTime}
            checkOutTime={data.calendar.property.checkOutTime}
            bars={computed.bars}
            bufferDates={computed.bufferDates}
            potentialDates={NO_DATES}
            unbookableDates={NO_DATES}
            sameDayCleaningDates={NO_DATES}
            conflictDates={computed.conflictDates}
            openOverrides={computed.openOverrides}
            closedOverrides={computed.closedOverrides}
            cleaningOverrides={NO_DATES}
            bufferPresentation="blocked"
            selectedDates={new Set<string>()}
            onSelectReservation={() => undefined}
            onCellClick={() => undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-4">
        <div className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 dark:bg-slate-900"><span className="h-3 w-3 rounded-full border border-slate-300 bg-white" /> Leer = frei</div>
        <div className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 dark:bg-slate-900"><span className="h-3 w-3 rounded-full bg-rose-500" /> Airbnb</div>
        <div className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 dark:bg-slate-900"><span className="h-3 w-3 rounded-full bg-[#003580]" /> Booking</div>
        <div className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 dark:bg-slate-900"><span className="h-3 w-3 rounded-full bg-slate-500" /> Sonstige</div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Ein Checkout-Tag bleibt für eine neue Anreise am selben Tag verfügbar. Nur Reservierungen, manuelle Sperren oder bewusst gesetzte Puffertage blockieren.</p>

      <section aria-labelledby="month-reservations-heading" className="space-y-2">
        <h3 id="month-reservations-heading" className="text-sm font-semibold">Reservierungen im Monat</h3>
        {monthReservations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">Keine Reservierung in diesem Monat.</p>
        ) : (
          monthReservations.map((reservation) => {
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{reservation.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{reservation.checkIn.slice(0, 10)}–{reservation.checkOut.slice(0, 10)}</span>
                </span>
                <span className="text-xs font-medium text-slate-500">{reservation.platform}</span>
              </>
            );
            const className = "flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900";
            return data.canWrite ? (
              <Link key={reservation.id} href={`/dashboard?property=${data.selectedProperty.id}&reservation=${reservation.id}&view=guests`} className={`${className} outline-none hover:border-rose-200 focus-visible:ring-2 focus-visible:ring-rose-500 dark:hover:border-rose-900`}>
                {content}
              </Link>
            ) : (
              <div key={reservation.id} className={className}>{content}</div>
            );
          })
        )}
      </section>
    </section>
  );
}
