"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import type { OperationalReminderDto } from "@/lib/operational-reminders";

interface OperationalRemindersPanelProps {
  propertyId?: number;
  compact?: boolean;
  initialReminders?: OperationalReminderDto[];
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(`${value}T12:00:00.000Z`));
}

function formatDueAt(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

export function OperationalRemindersPanel({
  propertyId,
  compact = false,
  initialReminders,
}: OperationalRemindersPanelProps) {
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
          Offene Aufgaben
        </h2>
      </div>
      <div className="mt-3 space-y-2">
        {reminders.map((reminder) => (
          <article key={reminder.id} className="rounded-lg border border-amber-200 bg-white/80 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">Booking-Haltefrist · nicht bestätigt</p>
                <p className="mt-0.5 text-xs text-amber-800">
                  {reminder.propertyName} · {reminder.portal} · {formatDate(reminder.startDate)}–{formatDate(reminder.endDate)}
                </p>
                <p className="mt-2 text-sm">{reminder.note}</p>
                <p className="mt-2 text-xs font-semibold text-amber-800">
                  Fällig am {formatDueAt(reminder.dueAt)} · manuell prüfen
                </p>
              </div>
              <button
                type="button"
                onClick={() => complete(reminder.id)}
                disabled={completingId === reminder.id}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-sm font-semibold text-amber-900 outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-50"
              >
                <Check aria-hidden className="h-4 w-4" />
                Erledigt
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
