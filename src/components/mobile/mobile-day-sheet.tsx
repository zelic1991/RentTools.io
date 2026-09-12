"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { germanApiError } from "@/lib/mobile-api-errors";
import { parseGrossAmountText } from "@/lib/reservation-revenue";
import {
  mobileDayActions,
  type MobileDayAction,
  type MobileDayState,
} from "@/lib/mobile-day-actions-core";

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

const ACTION_LABEL: Record<MobileDayAction, string> = {
  create: "Direktbuchung anlegen",
  block: "Tag sperren",
  unblock: "Sperre aufheben",
  edit: "Buchung bearbeiten",
  delete: "Buchung löschen",
};

const FIELD_CLASS =
  "mt-1 min-h-12 w-full rounded-xl border border-[var(--zf-control-border)] bg-[var(--zf-bg)] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-700 dark:bg-slate-950";

interface ReservationDetails {
  id: number;
  bookedGuestCount: number | null;
  grossAmountCents: number | null;
}

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

function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
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
    case "buffer":
      return "Puffertag aus den Kanal-Einstellungen";
    case "cleaning":
      return "Reinigung geplant";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("actions");
  const [pending, setPending] = useState<MobileDayAction | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(booked?.name ?? "");
  const [checkIn, setCheckIn] = useState(booked ? booked.checkIn.slice(0, 10) : date);
  const [checkOut, setCheckOut] = useState(booked ? booked.checkOut.slice(0, 10) : nextDay(date));
  const [guests, setGuests] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);


  async function send(
    key: MobileDayAction | "save",
    url: string,
    init: RequestInit,
    fallback: string,
  ): Promise<void> {
    setPending(key);
    setError(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = germanApiError(body?.error, fallback);
        const existing = body?.existing && typeof body.existing.name === "string"
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
      setPending(null);
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
    if (guestCount !== null && (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 50)) {
      // Same range the server enforces, so the phone does not promise
      // something the API will refuse.
      setError("Gästezahl bitte als ganze Zahl zwischen 1 und 50 eintragen.");
      return null;
    }
    const editing = mode === "edit";
    return {
      name: name.trim(),
      checkIn,
      checkOut,
      // While editing, the fields were filled from what is stored, so an
      // emptied field means "remove it" — the only way to clear an amount
      // from the phone. While creating, empty simply means unset.
      ...(guestCount === null
        ? editing
          ? { bookedGuestCount: null }
          : {}
        : { bookedGuestCount: guestCount }),
      ...(parsed.cents === null
        ? editing
          ? { grossAmountCents: null }
          : {}
        : { grossAmountCents: parsed.cents, currency: "EUR" }),
    };
  }

  /**
   * POST toggles: it removes an override of the same type instead of
   * setting it. Relying on that means a stale screen does the opposite of
   * the label — press "sperren" on a day someone already blocked and the
   * block disappears, with a success message. So each button states its
   * intent: unblock deletes, block deletes first and then sets, and both
   * end in the state the host asked for.
   */
  function changeBlock(action: MobileDayAction): void {
    const remove = `/api/date-overrides?propertyId=${propertyId}&date=${date}`;
    if (action === "unblock") {
      void send("unblock", remove, { method: "DELETE" }, "Die Sperre konnte nicht aufgehoben werden.");
      return;
    }
    setPending("block");
    setError(null);
    void (async () => {
      try {
        await fetch(remove, { method: "DELETE" });
      } catch {
        // Nothing to remove, or offline — the POST below reports either.
      } finally {
        setPending(null);
      }
      void send(
        "block",
        "/api/date-overrides",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId, date, type: "closed" }),
        },
        "Der Tag konnte nicht gesperrt werden.",
      );
    })();
  }

  function submit(): void {
    const body = buildBody();
    if (!body) return;
    if (mode === "create") {
      void send(
        "save",
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
      "save",
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
      "delete",
      `/api/reservations/${booked.id}`,
      { method: "DELETE" },
      "Die Buchung konnte nicht gelöscht werden.",
    );
  }

  /**
   * Guest count and amount are not part of the calendar payload, so the
   * edit form fetches them before it opens. Opening with empty fields
   * would offer to overwrite stored values with nothing.
   */
  async function openEdit(): Promise<void> {
    if (!booked) return;
    setPending("edit");
    try {
      const response = await fetch(`/api/reservations?propertyId=${propertyId}`);
      const rows: ReservationDetails[] | null = response.ok ? await response.json() : null;
      const row = Array.isArray(rows) ? rows.find((entry) => entry.id === booked.id) : null;
      if (!row) {
        setError("Die gespeicherten Werte konnten nicht geladen werden.");
        return;
      }
      setGuests(row.bookedGuestCount === null ? "" : String(row.bookedGuestCount));
      setAmount(centsToInput(row.grossAmountCents));
      setMode("edit");
    } catch {
      setError("Keine Verbindung. Bitte noch einmal versuchen.");
    } finally {
      setPending(null);
    }
  }

  function runAction(action: MobileDayAction): void {
    setError(null);
    if (action === "create") {
      setMode("create");
      return;
    }
    if (action === "edit") {
      void openEdit();
      return;
    }
    if (action === "delete") {
      remove();
      return;
    }
    changeBlock(action);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Schließen" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={formatDay(date)}
        tabIndex={-1}
        className="relative max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900"
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
            {state.kind === "cleaning" && (
              <p className="rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
                Für diesen Tag ist eine Reinigung eingeplant. Sperren geht hier nicht, weil das die
                Reinigung ersetzen und den Tag an die Portale als belegt melden würde. Eine Buchung
                lässt die Reinigung stehen.
              </p>
            )}
            {state.kind === "buffer" && (
              <p className="rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
                Der Puffer hält den Tag auf den Portalen frei. Eine Direktbuchung nimmt die App hier
                trotzdem an.
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
                disabled={pending !== null}
                onClick={() => runAction(action)}
                className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60 ${
                  action === "delete"
                    ? "border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                    : action === "create"
                      ? "bg-[var(--zf-brand-dark)] text-[var(--zf-on-brand)] dark:bg-white dark:text-slate-950"
                      : "border border-[var(--zf-border)] dark:border-slate-800"
                }`}
              >
                {pending === action && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
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
              {mode === "edit"
                ? "Die Felder zeigen, was gespeichert ist. Leerst du eines, wird der Wert gelöscht."
                : "Der Betrag zählt in den Berichten. Ohne Betrag bleibt die Buchung dort ohne Summe."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("actions");
                  setError(null);
                }}
                disabled={pending !== null}
                className="min-h-14 flex-1 rounded-xl border border-[var(--zf-border)] text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60 dark:border-slate-800"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending !== null}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--zf-brand-dark)] text-sm font-semibold text-[var(--zf-on-brand)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {pending === "save" && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                {mode === "create" ? "Buchung anlegen" : "Speichern"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
