import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  CircleHelp,
  Clock3,
  LogIn,
  LogOut,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { MobileCalendar } from "@/components/mobile/mobile-calendar";
import { MobilePwaRegister } from "@/components/mobile/mobile-pwa-register";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { loadMobileOperations, type MobileOperationsData, type MobileReservationCard } from "@/lib/mobile-operations";
import { MOBILE_SECTIONS, type MobileSection } from "@/lib/mobile-operations-core";

const DATE = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return DATE.format(new Date(`${value}T12:00:00.000Z`));
}

function formatDateTime(value: string | null): string {
  if (!value) return "Unbekannt";
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function reservationHref(data: MobileOperationsData, reservationId: number): string {
  return `/dashboard?property=${data.selectedProperty.id}&reservation=${reservationId}&view=guests`;
}

function ReservationRow({
  data,
  reservation,
  direction,
}: {
  data: MobileOperationsData;
  reservation: MobileReservationCard;
  direction?: "arrival" | "departure";
}) {
  const Icon = direction === "departure" ? LogOut : LogIn;
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{reservation.label}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {formatDate(reservation.checkIn)}–{formatDate(reservation.checkOut)} · {reservation.sourceLabel}
          {reservation.guestCount ? ` · ${reservation.guestCount} Gäste` : ""}
        </span>
      </span>
      <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
    </>
  );
  const className = "flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-slate-800 dark:bg-slate-900";
  return !data.canWrite ? (
    <div className={className}>{content}</div>
  ) : (
    <Link href={reservationHref(data, reservation.id)} className={`${className} hover:border-rose-200 hover:bg-rose-50/40 dark:hover:border-rose-900 dark:hover:bg-rose-950/20`}>
      {content}
    </Link>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
      {children}
    </div>
  );
}

function StartScreen({ data }: { data: MobileOperationsData }) {
  const openCount = data.start.openGuestTasks.length
    + data.start.ownerReviews.length
    + data.start.openEVisitor.length
    + data.start.portalProblems;
  return (
    <div className="space-y-7">
      <section aria-labelledby="today-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Heute · {formatDate(data.today)}</p>
            <h2 id="today-heading" className="mt-1 text-2xl font-semibold tracking-tight">Was passiert?</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.start.occupied.length ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
            {data.start.occupied.length ? "Belegt" : "Frei"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Anreisen", data.start.arrivals.length, LogIn],
            ["Abreisen", data.start.departures.length, LogOut],
            ["Im Haus", data.start.occupied.length, UsersRound],
            ["Offen", openCount, AlertCircle],
          ].map(([label, count, Icon]) => {
            const CardIcon = Icon as typeof LogIn;
            return (
              <div key={String(label)} className="min-h-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <CardIcon aria-hidden className="h-5 w-5 text-rose-600" />
                <div className="mt-3 text-2xl font-semibold tabular-nums">{String(count)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{String(label)}</div>
              </div>
            );
          })}
        </div>
        {(data.start.arrivals.length > 0 || data.start.departures.length > 0) && (
          <div className="mt-3 space-y-2">
            {data.start.arrivals.map((reservation) => <ReservationRow key={`a-${reservation.id}`} data={data} reservation={reservation} direction="arrival" />)}
            {data.start.departures.map((reservation) => <ReservationRow key={`d-${reservation.id}`} data={data} reservation={reservation} direction="departure" />)}
          </div>
        )}
      </section>

      <section aria-labelledby="next-heading">
        <h2 id="next-heading" className="mb-3 text-lg font-semibold tracking-tight">Als Nächstes</h2>
        {data.start.next ? <ReservationRow data={data} reservation={data.start.next} direction="arrival" /> : <EmptyState>Keine nächste Reservierung im aktuellen Buchungsfenster.</EmptyState>}
      </section>

      <section aria-labelledby="tasks-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="tasks-heading" className="text-lg font-semibold tracking-tight">Offene Punkte</h2>
            <span className="text-xs text-slate-500">{openCount} insgesamt</span>
          </div>
          {openCount === 0 ? (
            <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0" /> Keine offenen Aufgaben aus den aktuell nachweisbaren RentTools-Statuswerten.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Gästedaten fehlen", data.start.openGuestTasks.length, "/mobile/guests"],
                ["Owner-Review", data.start.ownerReviews.length, "/mobile/guests"],
                ["eVisitor offen", data.start.openEVisitor.length, "/mobile/guests"],
                ...(data.access === "owner"
                  ? [["Portal-/Feedproblem", data.start.portalProblems, "/mobile/portals"]]
                  : []),
              ].map(([label, count, href]) => (
                <Link key={String(label)} href={String(href)} className="flex min-h-14 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm outline-none hover:border-rose-200 focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-rose-900">
                  <span>{String(label)}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 tabular-nums dark:bg-slate-800">{String(count)}</span>
                </Link>
              ))}
            </div>
          )}
      </section>

      <section aria-labelledby="quick-heading">
        <h2 id="quick-heading" className="mb-3 text-lg font-semibold tracking-tight">Schnellzugriff</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/mobile/calendar" className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:bg-white dark:text-slate-950">
            <Clock3 aria-hidden className="h-5 w-5" /> Kalender öffnen
          </Link>
          {data.canWrite && (
            <Link href={`/dashboard?property=${data.selectedProperty.id}&view=calendar`} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
              <CalendarPlus aria-hidden className="h-5 w-5 text-rose-600" /> Direktreservierung anlegen
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  NOT_INVITED: "Nicht eingeladen",
  INVITED: "Link erstellt",
  IN_PROGRESS: "In Bearbeitung",
  COMPLETE: "Vollständig",
  OWNER_REVIEW_REQUIRED: "Owner-Review nötig",
  OWNER_APPROVED: "Freigegeben",
  REVOKED: "Widerrufen",
};

const EVISITOR_LABELS: Record<string, string> = {
  NOT_READY: "Noch nicht bereit",
  READY_NOT_SUBMITTED: "Bereit, nicht gesendet",
  PRODUCTION_PENDING: "Produktionslauf noch unbestätigt",
  READBACK_CONFIRMED: "Readback bestätigt",
  PRODUCTION_ERROR: "Produktionsfehler",
};

function GuestsScreen({ data }: { data: MobileOperationsData }) {
  return (
    <section aria-labelledby="guests-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Gäste</p>
        <h2 id="guests-heading" className="mt-1 text-2xl font-semibold tracking-tight">Pre-Check-in</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nur bestätigte Backend-Zustände – keine automatische eVisitor-Aktion.</p>
      </div>
      {data.guests.length === 0 ? <EmptyState>Keine aktuelle oder kommende Reservierung.</EmptyState> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.guests.map((reservation) => (
            <article key={reservation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{reservation.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(reservation.checkIn)}–{formatDate(reservation.checkOut)} · {reservation.sourceLabel}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${reservation.guestState.complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                  {STATUS_LABELS[reservation.guestState.status] ?? reservation.guestState.status}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><dt className="text-xs text-slate-500 dark:text-slate-400">Gästezahl</dt><dd className="mt-1 font-semibold">{reservation.guestCount ?? "Nicht bestätigt"}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><dt className="text-xs text-slate-500 dark:text-slate-400">eVisitor</dt><dd className="mt-1 font-semibold">{EVISITOR_LABELS[reservation.guestState.eVisitorStatus]}</dd></div>
              </dl>
              {reservation.guestState.missingFields.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {reservation.guestState.missingFields.join(" · ")}
                </div>
              )}
              {reservation.guestState.status === "IN_PROGRESS" && (
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Einzelne fehlende Felder werden im aktuellen sicheren Draft nicht als Klartext-Status gespeichert.</p>
              )}
              {data.canWrite ? (
                <Link href={reservationHref(data, reservation.id)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:bg-white dark:text-slate-950">
                  Gastdaten öffnen <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              ) : (
                <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-center text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Support-Ansicht ist schreibgeschützt.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PortalsScreen({ data }: { data: MobileOperationsData }) {
  return (
    <section aria-labelledby="portals-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Portale</p>
        <h2 id="portals-heading" className="mt-1 text-2xl font-semibold tracking-tight">Verbindungen</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kompakte Statussicht ohne Feed-URLs oder technische Rohlogs.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.portals.map((portal) => {
          const Icon = portal.hasError ? AlertCircle : portal.connected === false ? CircleHelp : ShieldCheck;
          const tone = portal.hasError
            ? "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
          return (
            <article key={portal.id} className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${portal.hasError ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{portal.name}</h3><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{portal.connected === null ? "Manuell" : portal.connected ? "Verbunden" : "Nicht verbunden"}</span></div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{portal.message}</p>
                </div>
              </div>
              <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-950/50"><dt className="text-slate-500">Letzter Erfolg</dt><dd className="mt-1 font-medium">{formatDateTime(portal.lastSuccessfulSyncAt)}</dd></div>
                <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-950/50"><dt className="text-slate-500">Kommende Einträge</dt><dd className="mt-1 font-medium tabular-nums">{portal.upcomingEvents}</dd></div>
                <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-950/50"><dt className="text-slate-500">Belegt bis</dt><dd className="mt-1 font-medium">{portal.lastKnownOccupancyEnd ? formatDate(portal.lastKnownOccupancyEnd) : "Unbekannt"}</dd></div>
              </dl>
              {portal.hasError && portal.lastAttemptAt && !portal.lastSuccessfulSyncAt && (
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Letzter Abruf: {formatDateTime(portal.lastAttemptAt)}. Der vorherige erfolgreiche Zeitpunkt wird im aktuellen Datenmodell nicht separat gespeichert.</p>
              )}
              {data.canSeeTechnicalDetails && (
                <Link href={`/dashboard?property=${data.selectedProperty.id}&view=sync`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-rose-700 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300">Details öffnen <ArrowRight aria-hidden className="h-4 w-4" /></Link>
              )}
            </article>
          );
        })}
      </div>
      {!data.canSeeTechnicalDetails && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Technische Feeddetails und Fehlertexte sind Owner-only.</div>
      )}
    </section>
  );
}

export default async function MobileOperationsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const route = await params;
  if ((route.section?.length ?? 0) > 1) notFound();
  const rawSection = route.section?.[0] ?? "start";
  if (!MOBILE_SECTIONS.includes(rawSection as MobileSection)) notFound();
  const data = await loadMobileOperations({
    section: rawSection as MobileSection,
  });

  return (
    <MobileShell data={data}>
      <MobilePwaRegister />
      {data.section === "start" && <StartScreen data={data} />}
      {data.section === "calendar" && <MobileCalendar data={data} />}
      {data.section === "guests" && <GuestsScreen data={data} />}
      {data.section === "portals" && <PortalsScreen data={data} />}
    </MobileShell>
  );
}
