"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import type { OperationalReminderDto } from "@/lib/operational-reminders";
import { useI18n } from "@/lib/i18n/context";
import { mobileIntlTag } from "@/lib/i18n/mobile-locale";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

interface OperationalRemindersPanelProps {
  propertyId?: number;
  compact?: boolean;
  initialReminders?: OperationalReminderDto[];
}

const COPY: CopyMap<{
  heading: string;
  title: string;
  due: (date: string) => string;
  done: string;
}> = {
  en: {
    heading: "Open tasks",
    title: "Booking hold period · not confirmed",
    due: (date) => `Due on ${date} · check manually`,
    done: "Done",
  },
  ru: {
    heading: "Открытые задачи",
    title: "Срок удержания Booking · не подтверждено",
    due: (date) => `Срок: ${date} · проверить вручную`,
    done: "Готово",
  },
  de: {
    heading: "Offene Aufgaben",
    title: "Booking-Haltefrist · nicht bestätigt",
    due: (date) => `Fällig am ${date} · manuell prüfen`,
    done: "Erledigt",
  },
  fr: {
    heading: "Tâches en cours",
    title: "Délai de blocage Booking · non confirmé",
    due: (date) => `Échéance le ${date} · à vérifier manuellement`,
    done: "Terminé",
  },
  es: {
    heading: "Tareas pendientes",
    title: "Plazo de retención de Booking · no confirmado",
    due: (date) => `Vence el ${date} · comprobar manualmente`,
    done: "Hecho",
  },
  hr: {
    heading: "Otvoreni zadaci",
    title: "Rok zadržavanja na Bookingu · nije potvrđeno",
    due: (date) => `Rok: ${date} · provjerite ručno`,
    done: "Riješeno",
  },
};

export function OperationalRemindersPanel({
  propertyId,
  compact = false,
  initialReminders,
}: OperationalRemindersPanelProps) {
  const { locale } = useI18n();
  const copy = resolveCopy(COPY, locale);
  const dateFormat = new Intl.DateTimeFormat(mobileIntlTag(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formatDate = (value: string): string => dateFormat.format(new Date(`${value}T12:00:00.000Z`));
  const formatDueAt = (value: string): string => dateFormat.format(new Date(value));
  const [reminders, setReminders] = useState<OperationalReminderDto[]>(
    () => (initialReminders ?? []).filter((reminder) => reminder.status === "OPEN"),
  );
  const [loading, setLoading] = useState(initialReminders === undefined);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const query = propertyId ? `?propertyId=${propertyId}` : "";
      const response = await fetch(`/api/operational-reminders${query}`);
      if (!response.ok) {
        setReminders([]);
        return;
      }
      const data = await response.json() as { reminders?: OperationalReminderDto[] };
      setReminders((data.reminders ?? []).filter((reminder) => reminder.status === "OPEN"));
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (initialReminders === undefined) void load();
  }, [initialReminders, load]);

  const complete = async (id: number) => {
    setCompletingId(id);
    try {
      const response = await fetch(`/api/operational-reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (response.ok) {
        setReminders((current) => current.filter((reminder) => reminder.id !== id));
      }
    } finally {
      setCompletingId(null);
    }
  };

  if (loading || reminders.length === 0) return null;

  return (
    <section
      aria-labelledby={`operational-reminders-${propertyId ?? "all"}`}
      className={`rounded-xl border border-amber-300/70 bg-amber-50 text-amber-950 ${compact ? "p-3" : "p-4"}`}
      data-testid="operational-reminders"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-amber-700" />
        <h2 id={`operational-reminders-${propertyId ?? "all"}`} className="text-sm font-semibold">
          {copy.heading}
        </h2>
      </div>
      <div className="mt-3 space-y-2">
        {reminders.map((reminder) => (
          <article key={reminder.id} className="rounded-lg border border-amber-200 bg-white/80 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{copy.title}</p>
                <p className="mt-0.5 text-xs text-amber-800">
                  {reminder.propertyName} · {reminder.portal} · {formatDate(reminder.startDate)}–{formatDate(reminder.endDate)}
                </p>
                <p className="mt-2 text-sm">{reminder.note}</p>
                <p className="mt-2 text-xs font-semibold text-amber-800">
                  {copy.due(formatDueAt(reminder.dueAt))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => complete(reminder.id)}
                disabled={completingId === reminder.id}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-sm font-semibold text-amber-900 outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-50"
              >
                <Check aria-hidden className="h-4 w-4" />
                {copy.done}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
