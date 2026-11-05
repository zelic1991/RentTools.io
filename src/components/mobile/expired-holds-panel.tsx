"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { mobileIntlTag } from "@/lib/i18n/mobile-locale";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";
import type { ExpiredHold } from "@/lib/held-blocks";

/**
 * Blocks kept for a guest whose deadline has passed. They still close the
 * dates on every portal, so the start screen asks once per block and lifts
 * the whole run in one tap.
 */

interface Copy {
  heading: string;
  hint: string;
  line: (from: string, lastNight: string, holdUntil: string) => string;
  lift: string;
  keep: string;
  failed: string;
}

const COPY: CopyMap<Copy> = {
  en: {
    heading: "Hold expired",
    hint: "These dates are still blocked on Airbnb and Booking.com.",
    line: (f, l, h) => `${f} – ${l} · held until ${h}`,
    lift: "Lift block",
    keep: "Calendar",
    failed: "The block could not be lifted.",
  },
  ru: {
    heading: "Срок брони истёк",
    hint: "Эти даты всё ещё закрыты на Airbnb и Booking.com.",
    line: (f, l, h) => `${f} – ${l} · держалось до ${h}`,
    lift: "Снять блок",
    keep: "Календарь",
    failed: "Не удалось снять блок.",
  },
  de: {
    heading: "Frist abgelaufen",
    hint: "Diese Tage sind auf Airbnb und Booking.com noch gesperrt.",
    line: (f, l, h) => `${f} – ${l} · gehalten bis ${h}`,
    lift: "Sperre aufheben",
    keep: "Kalender",
    failed: "Die Sperre konnte nicht aufgehoben werden.",
  },
  fr: {
    heading: "Délai expiré",
    hint: "Ces dates sont toujours bloquées sur Airbnb et Booking.com.",
    line: (f, l, h) => `${f} – ${l} · gardé jusqu’au ${h}`,
    lift: "Lever le blocage",
    keep: "Calendrier",
    failed: "Le blocage n’a pas pu être levé.",
  },
  es: {
    heading: "Plazo vencido",
    hint: "Estas fechas siguen bloqueadas en Airbnb y Booking.com.",
    line: (f, l, h) => `${f} – ${l} · mantenido hasta ${h}`,
    lift: "Quitar bloqueo",
    keep: "Calendario",
    failed: "No se pudo quitar el bloqueo.",
  },
  hr: {
    heading: "Rok istekao",
    hint: "Ovi datumi su još blokirani na Airbnbu i Booking.comu.",
    line: (f, l, h) => `${f} – ${l} · držano do ${h}`,
    lift: "Ukloni blokadu",
    keep: "Kalendar",
    failed: "Blokadu nije bilo moguće ukloniti.",
  },
};

function previousDay(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function ExpiredHoldsPanel({ propertyId, holds }: { propertyId: number; holds: ExpiredHold[] }) {
  const router = useRouter();
  const { locale } = useI18n();
  const copy = resolveCopy(COPY, locale);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (holds.length === 0) return null;

  const day = new Intl.DateTimeFormat(mobileIntlTag(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const fmt = (iso: string) => day.format(new Date(`${iso}T12:00:00.000Z`));

  async function lift(hold: ExpiredHold) {
    setPending(hold.from);
    setError(null);
    try {
      const res = await fetch(
        `/api/date-overrides?propertyId=${propertyId}&from=${hold.from}&to=${hold.to}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(copy.failed);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="px-1 pb-2">
        <h3 className="text-sm font-semibold">{copy.heading}</h3>
        <p className="mt-0.5 text-xs text-[var(--zf-text-muted)] dark:text-slate-400">{copy.hint}</p>
      </div>
      {error && <p className="px-1 pb-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <ul className="space-y-2">
        {holds.map((hold) => (
          <li
            key={hold.from}
            className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {copy.line(fmt(hold.from), fmt(previousDay(hold.to)), fmt(hold.holdUntil))}
            </span>
            <Link
              href="/mobile/calendar"
              className="rounded-full border border-[var(--zf-border)] px-3 py-1 text-xs font-semibold dark:border-slate-700"
            >
              {copy.keep}
            </Link>
            <button
              type="button"
              onClick={() => lift(hold)}
              disabled={pending !== null}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--zf-brand-dark)] px-3 py-1 text-xs font-semibold text-[var(--zf-on-brand)] disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {pending === hold.from && <Loader2 aria-hidden className="h-3 w-3 animate-spin" />}
              {copy.lift}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
