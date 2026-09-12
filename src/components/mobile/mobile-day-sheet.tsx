"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { parseGrossAmountText } from "@/lib/reservation-revenue";
import { mobileDayActions, type MobileDayState } from "@/lib/mobile-day-actions-core";

/**
 * Tap a day, do the thing. Until now the phone calendar could only be
 * read: booking a stay or blocking a night meant finding a laptop, which
 * is the wrong constraint for the person standing in the apartment.
 */

const DATE_LABEL = new Intl.DateTimeFormat("de-AT", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const PLATFORM_LABEL: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  direct: "Direkt",
};

const ACTION_LABEL = {
  create: "Direktbuchung anlegen",
  block: "Tag sperren",
  unblock: "Sperre aufheben",
  edit: "Buchung bearbeiten",
  delete: "Buchung löschen",
} as const;

const FIELD_CLASS =
  "mt-1 min-h-12 w-full rounded-xl border border-[var(--zf-control-border)] bg-[var(--zf-bg)] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-700 dark:bg-slate-950";

function formatDay(date: string): string {
  return DATE_LABEL.format(new Date(`${date}T12:00:00.000Z`));
}

function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform.toLowerCase()] ?? platform;
}

function nextDay(date: string): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function stateLine(state: MobileDayState): string {
  switch (state.kind) {
    case "reservation":
      return `${state.reservation.name} · ${state.reservation.checkIn.slice(0, 10)}–${state.reservation.checkOut.slice(0, 10)} · ${platformLabel(state.reservation.platform)}`;
    case "event":
      return `Belegt über ${platformLabel(state.platform)} · ${state.startDate}–${state.endDate}`;
    case "blocked":
      return "Gesperrt, nicht buchbar";
    case "forced-open":
      return "Manuell freigegeben";
    default:
      return "Frei";
  }
}

type Mode = "actions" | "create" | "edit";

export function MobileDaySheet({
  propertyId,
  date,
  state,
  canWrite,
  onClose,
}: {
  propertyId: number;
  date: string;
  state: MobileDayState;
  canWrite: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const actions = mobileDayActions(state, canWrite);
  const booked = state.kind === "reservation" ? state.reservation : null;
  const [mode, setMode] = useState<Mode>("actions");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(booked?.name ?? "");
  const [checkIn, setCheckIn] = useState(booked ? booked.checkIn.slice(0, 10) : date);
  const [checkOut, setCheckOut] = useState(booked ? booked.checkOut.slice(0, 10) : nextDay(date));
  const [guests, setGuests] = useState("");
  const [amount, setAmount] = useState("");

  async function send(url: string, init: RequestInit, fallback: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body && typeof body.error === "string" ? body.error : fallback;
        const existing = body && body.existing && typeof body.existing.name === "string"
          ? ` (${body.existing.name}, ${String(body.existing.checkIn).slice(0, 10)}–${String(body.existing.checkOut).slice(0, 10)})`
          : "";
        setError(`${message}${existing}`);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Keine Verbindung. Bitte noch einmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  function buildBody(): Record<string, unknown> | null {
    if (!name.trim()) {
      setError("Bitte einen Namen eintragen.");
      return null;
    }
    if (checkOut <= checkIn) {
      setError("Die Abreise muss nach der Anreise liegen.");
      return null;
    }
    const parsed = parseGrossAmountText(amount);
    if (!parsed.ok) {
      setError("Betrag bitte als Zahl eintragen, zum Beispiel 162,80.");
      return null;
    }
    const trimmedGuests = guests.trim();
    const guestCount = trimmedGuests === "" ? null : Number(trimmedGuests);
    if (guestCount !== null && (!Number.isInteger(guestCount) || guestCount < 1)) {
      setError("Gästezahl bitte als ganze Zahl eintragen.");
      return null;
    }
    return {
      name: name.trim(),
      checkIn,
      checkOut,
      ...(guestCount === null ? {} : { bookedGuestCount: guestCount }),
      ...(parsed.cents === null ? {} : { grossAmountCents: parsed.cents, currency: "EUR" }),
    };
  }

  function toggleBlock(): void {
    void send(
      "/api/date-overrides",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, date, type: "closed" }),
      },
      "Der Tag konnte nicht geändert werden.",
    );
  }

  function submit(): void {
    const body = buildBody();
    if (!body) return;
    if (mode === "create") {
      void send(
        "/api/reservations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, propertyId, platform: "direct" }),
        },
        "Die Buchung konnte nicht angelegt werden.",
      );
      return;
    }
    if (!booked) return;
    void send(
      `/api/reservations/${booked.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "Die Änderung konnte nicht gespeichert werden.",
    );
  }

  function remove(): void {
    if (!booked) return;
    if (!window.confirm(`Buchung "${booked.name}" wirklich löschen?`)) return;
    void send(
      `/api/reservations/${booked.id}`,
      { method: "DELETE" },
      "Die Buchung konnte nicht gelöscht werden.",
    );
  }

  function runAction(action: (typeof actions)[number]): void {
    setError(null);
    if (action === "create") {
      setMode("create");
      return;
    }
    if (action === "edit") {
      setMode("edit");
      return;
    }
    if (action === "delete") {
      remove();
      return;
    }
    toggleBlock();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Schließen" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={formatDay(date)}
        className="relative max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--zf-brand)]">
              {mode === "create" ? "Neue Direktbuchung" : mode === "edit" ? "Buchung bearbeiten" : "Tag"}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{formatDay(date)}</h2>
            <p className="mt-1 text-sm text-[var(--zf-text-muted)] dark:text-slate-400">{stateLine(state)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--zf-text-muted)] outline-none hover:bg-[var(--zf-surface)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)]"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        )}

        {mode === "actions" ? (
          <div className="space-y-2">
            {state.kind === "event" && (
              <p className="rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
                Diese Buchung kommt von {platformLabel(state.platform)} und wird dort geändert.
              </p>
            )}
            {actions.length === 0 && state.kind !== "event" && (
              <p className="rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
                Diese Ansicht ist schreibgeschützt.
              </p>
            )}
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy}
                onClick={() => runAction(action)}
                className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60 ${
                  action === "delete"
                    ? "border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                    : action === "create"
                      ? "bg-[var(--zf-brand-dark)] text-[var(--zf-on-brand)] dark:bg-white dark:text-slate-950"
                      : "border border-[var(--zf-border)] dark:border-slate-800"
                }`}
              >
                {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                {ACTION_LABEL[action]}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Wer kommt?"
                className={FIELD_CLASS}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Anreise
                <input
                  type="date"
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block text-sm font-medium">
                Abreise
                <input
                  type="date"
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Gäste
                <input
                  inputMode="numeric"
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                  placeholder="optional"
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block text-sm font-medium">
                Betrag (€)
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="optional"
                  className={FIELD_CLASS}
                />
              </label>
            </div>
            <p className="text-xs text-[var(--zf-text-muted)] dark:text-slate-400">
              Der Betrag zählt in den Berichten. Ohne Betrag bleibt die Buchung dort ohne Summe.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("actions");
                  setError(null);
                }}
                disabled={busy}
                className="min-h-14 flex-1 rounded-xl border border-[var(--zf-border)] text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60 dark:border-slate-800"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--zf-brand-dark)] text-sm font-semibold text-[var(--zf-on-brand)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                {mode === "create" ? "Buchung anlegen" : "Speichern"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
