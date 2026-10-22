"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { useCalendarData } from "@/components/calendar/use-calendar-data";
import type { MobileOperationsData } from "@/lib/mobile-operations";
import { OperationalRemindersPanel } from "@/components/operational-reminders-panel";
import { MobileDaySheet } from "@/components/mobile/mobile-day-sheet";
import { resolveMobileDay } from "@/lib/mobile-day-actions-core";
import { safePlatformLabel } from "@/lib/mobile-operations-core";
import { useI18n } from "@/lib/i18n/context";
import { mobileIntlTag } from "@/lib/i18n/mobile-locale";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

const COPY: CopyMap<{
  weekdays: string[];
  eyebrow: string;
  heading: string;
  today: string;
  previousMonth: string;
  nextMonth: string;
  emptyIsFree: string;
  other: string;
  tapHint: string;
  checkoutHint: string;
  monthReservations: string;
  noMonthReservations: string;
}> = {
  en: {
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    eyebrow: "Calendar",
    heading: "Free or occupied",
    today: "Today",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    emptyIsFree: "Empty = free",
    other: "Other",
    tapHint: "Tap a day to book it, block it or change a booking.",
    checkoutHint: "A check-out day stays available for a new arrival on the same day. Only reservations, manual blocks or deliberately set buffer days block.",
    monthReservations: "Reservations this month",
    noMonthReservations: "No reservation this month.",
  },
  ru: {
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    eyebrow: "Календарь",
    heading: "Свободно или занято",
    today: "Сегодня",
    previousMonth: "Предыдущий месяц",
    nextMonth: "Следующий месяц",
    emptyIsFree: "Пусто = свободно",
    other: "Другое",
    tapHint: "Нажмите на день, чтобы забронировать, заблокировать его или изменить бронирование.",
    checkoutHint: "День выезда остаётся доступным для нового заезда в тот же день. Блокируют только бронирования, ручные блокировки или намеренно заданные буферные дни.",
    monthReservations: "Бронирования за месяц",
    noMonthReservations: "В этом месяце нет бронирований.",
  },
  de: {
    weekdays: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    eyebrow: "Kalender",
    heading: "Frei oder belegt",
    today: "Heute",
    previousMonth: "Vorheriger Monat",
    nextMonth: "Nächster Monat",
    emptyIsFree: "Leer = frei",
    other: "Sonstige",
    tapHint: "Tippe einen Tag an, um zu buchen, zu sperren oder eine Buchung zu ändern.",
    checkoutHint: "Ein Checkout-Tag bleibt für eine neue Anreise am selben Tag verfügbar. Nur Reservierungen, manuelle Sperren oder bewusst gesetzte Puffertage blockieren.",
    monthReservations: "Reservierungen im Monat",
    noMonthReservations: "Keine Reservierung in diesem Monat.",
  },
  fr: {
    weekdays: ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"],
    eyebrow: "Calendrier",
    heading: "Libre ou occupé",
    today: "Aujourd’hui",
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    emptyIsFree: "Vide = libre",
    other: "Autre",
    tapHint: "Touchez un jour pour réserver, bloquer ou modifier une réservation.",
    checkoutHint: "Un jour de départ reste disponible pour une nouvelle arrivée le même jour. Seuls les réservations, les blocages manuels ou les jours tampons définis volontairement bloquent.",
    monthReservations: "Réservations du mois",
    noMonthReservations: "Aucune réservation ce mois-ci.",
  },
  es: {
    weekdays: ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"],
    eyebrow: "Calendario",
    heading: "Libre u ocupado",
    today: "Hoy",
    previousMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    emptyIsFree: "Vacío = libre",
    other: "Otros",
    tapHint: "Toca un día para reservar, bloquear o cambiar una reserva.",
    checkoutHint: "Un día de salida sigue disponible para una nueva llegada el mismo día. Solo bloquean las reservas, los bloqueos manuales o los días tampón establecidos a propósito.",
    monthReservations: "Reservas del mes",
    noMonthReservations: "No hay reservas este mes.",
  },
  hr: {
    weekdays: ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"],
    eyebrow: "Kalendar",
    heading: "Slobodno ili zauzeto",
    today: "Danas",
    previousMonth: "Prethodni mjesec",
    nextMonth: "Sljedeći mjesec",
    emptyIsFree: "Prazno = slobodno",
    other: "Ostalo",
    tapHint: "Dodirnite dan da biste ga rezervirali, blokirali ili promijenili rezervaciju.",
    checkoutHint: "Dan odlaska ostaje dostupan za novi dolazak istog dana. Blokiraju samo rezervacije, ručne blokade ili namjerno postavljeni dani pauze.",
    monthReservations: "Rezervacije u mjesecu",
    noMonthReservations: "Nema rezervacija u ovom mjesecu.",
  },
};

const NO_DATES = new Set<string>();
function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function MobileCalendar({ data }: { data: MobileOperationsData }) {
  const { locale } = useI18n();
  const copy = resolveCopy(COPY, locale);
  const monthFormat = new Intl.DateTimeFormat(mobileIntlTag(locale), { month: "long", year: "numeric", timeZone: "UTC" });
  const [year, initialMonth] = data.today.split("-").map(Number);
  const [active, setActive] = useState({ year, month: initialMonth - 1 });
  // Support sessions read; owner and manager act.
  const canEdit = data.canWrite && (data.access === "owner" || data.access === "manager");
  const [openDate, setOpenDate] = useState<string | null>(null);
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
  const monthReminders = data.operationalReminders.filter(
    (reminder) => reminder.startDate < monthEnd && reminder.endDate > monthStart,
  );

  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(active.year, active.month + delta, 1));
    const nextValue = { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    const key = monthKey(nextValue.year, nextValue.month);
    if (key >= minMonth && key <= maxMonth) setActive(nextValue);
  };

  const dayState = openDate
    ? resolveMobileDay(openDate, {
        reservations: data.calendar.property.reservations.map((reservation) => ({
          id: reservation.id,
          name: reservation.name,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          platform: reservation.platform,
        })),
        events: data.calendar.events.map((event) => ({
          platform: event.platform,
          startDate: event.startDate,
          endDate: event.endDate,
        })),
        overrides: data.calendar.overrides,
        // Same set the grid strikes through, so the sheet cannot call a
        // buffer day free.
        bufferDates: computed.bufferDates,
        cleaningDates: data.calendar.cleaningDates,
      })
    : null;

  return (
    <section aria-labelledby="mobile-calendar-heading" className="space-y-4 text-[var(--zf-text)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--zf-brand)]">{copy.eyebrow}</p>
          <h2 id="mobile-calendar-heading" className="mt-1 text-2xl font-semibold tracking-tight">{copy.heading}</h2>
        </div>
        <button
          type="button"
          onClick={() => setActive({ year, month: initialMonth - 1 })}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--zf-control-border)] bg-[var(--zf-brand-soft)] px-3 text-sm font-medium text-[var(--zf-brand-dark)] shadow-sm outline-none hover:bg-[var(--zf-brand-pale)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)]"
        >
          <RotateCcw aria-hidden className="h-4 w-4" /> {copy.today}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--zf-border)] bg-[var(--zf-bg)] shadow-sm">
        <div className="flex min-h-14 items-center justify-between border-b border-[var(--zf-border)] bg-[var(--zf-surface)] px-2 sm:px-4">
          <button
            type="button"
            aria-label={copy.previousMonth}
            onClick={() => moveMonth(-1)}
            disabled={activeKey <= minMonth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--zf-brand-dark)] outline-none hover:bg-[var(--zf-brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-30"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-base font-semibold capitalize">
            <CalendarDays aria-hidden className="h-4 w-4 text-[var(--zf-brand)]" />
            {monthFormat.format(new Date(Date.UTC(active.year, active.month, 1)))}
          </div>
          <button
            type="button"
            aria-label={copy.nextMonth}
            onClick={() => moveMonth(1)}
            disabled={activeKey >= maxMonth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--zf-brand-dark)] outline-none hover:bg-[var(--zf-brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-30"
          >
            <ChevronRight aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-[var(--zf-border)] bg-[var(--zf-brand-soft)] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--zf-text-muted)] sm:px-2">
          {copy.weekdays.map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="overflow-hidden px-1 pb-2 pt-1 sm:px-2">
          <CalendarGrid
            readOnly={!canEdit}
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
            onSelectReservation={(id) => {
              const reservation = data.calendar.property.reservations.find((row) => row.id === id);
              if (reservation) setOpenDate(reservation.checkIn.slice(0, 10));
            }}
            onCellClick={(dateStr) => setOpenDate(dateStr)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--zf-text-muted)] sm:grid-cols-4">
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-3"><span className="h-3 w-3 rounded-full border border-[var(--zf-control-border)] bg-[var(--zf-bg)]" /> {copy.emptyIsFree}</div>
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-3"><span className="h-3 w-3 rounded-full bg-[#FF385C]" /> Airbnb</div>
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-3"><span className="h-3 w-3 rounded-full bg-[#003580]" /> Booking</div>
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-3"><span className="h-3 w-3 rounded-full bg-[var(--zf-text-muted)]" /> {copy.other}</div>
      </div>
      {canEdit && (
        <p className="text-xs text-[var(--zf-text-muted)]">{copy.tapHint}</p>
      )}
      <p className="text-xs text-[var(--zf-text-muted)]">{copy.checkoutHint}</p>

      <OperationalRemindersPanel
        propertyId={data.selectedProperty.id}
        initialReminders={monthReminders}
        compact
      />

      <section aria-labelledby="month-reservations-heading" className="space-y-2">
        <h3 id="month-reservations-heading" className="text-sm font-semibold">{copy.monthReservations}</h3>
        {monthReservations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--zf-control-border)] bg-[var(--zf-bg)]/70 px-4 py-3 text-sm text-[var(--zf-text-muted)]">{copy.noMonthReservations}</p>
        ) : (
          monthReservations.map((reservation) => {
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{reservation.name}</span>
                  <span className="block text-xs text-[var(--zf-text-muted)]">{reservation.checkIn.slice(0, 10)}–{reservation.checkOut.slice(0, 10)}</span>
                </span>
                <span className="text-xs font-medium text-[var(--zf-text-muted)]">{reservation.platform === "other" ? copy.other : safePlatformLabel(reservation.platform, locale)}</span>
              </>
            );
            const className = "flex min-h-12 items-center gap-3 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 text-sm shadow-sm";
            return data.canWrite ? (
              <Link key={reservation.id} href={`/dashboard?property=${data.selectedProperty.id}&reservation=${reservation.id}&view=guests`} className={`${className} outline-none hover:border-[var(--zf-brand-hover)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)]`}>
                {content}
              </Link>
            ) : (
              <div key={reservation.id} className={className}>{content}</div>
            );
          })
        )}
      </section>
      {openDate && dayState && (
        <MobileDaySheet
          propertyId={data.selectedProperty.id}
          date={openDate}
          state={dayState}
          canWrite={canEdit}
          onClose={() => setOpenDate(null)}
        />
      )}
    </section>
  );
}
