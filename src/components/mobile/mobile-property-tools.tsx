"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { germanApiError } from "@/lib/mobile-api-errors";
import { validateMobilePropertySettings } from "@/lib/mobile-property-settings-core";

/**
 * The two things a host wants from the phone when a portal looks stale:
 * pull the calendars now, and correct the house rules that decide what
 * the portals may sell. Everything else about a property — feed tokens,
 * channel wiring, cleaning setup — stays on the desktop, where there is
 * room to be careful.
 */

const FIELD =
  "mt-1 min-h-12 w-full rounded-xl border border-[var(--zf-control-border)] bg-[var(--zf-bg)] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-700 dark:bg-slate-950";
const BUTTON =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60";

export function MobilePropertyTools({
  propertyId,
  minNights,
  checkInTime,
  checkOutTime,
}: {
  propertyId: number;
  minNights: number;
  checkInTime: string;
  checkOutTime: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"sync" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [nights, setNights] = useState(String(minNights));
  const [checkIn, setCheckIn] = useState(checkInTime);
  const [checkOut, setCheckOut] = useState(checkOutTime);

  async function run(
    key: "sync" | "save",
    url: string,
    init: RequestInit,
    fallback: string,
    success: (body: unknown) => string | null,
  ): Promise<void> {
    setPending(key);
    setError(null);
    setDone(null);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(germanApiError((body as { error?: unknown } | null)?.error, fallback));
        return;
      }
      const message = success(body);
      if (message === null) return;
      setDone(message);
      router.refresh();
    } catch {
      setError("Keine Verbindung. Bitte noch einmal versuchen.");
    } finally {
      setPending(null);
    }
  }

  function syncNow(): void {
    void run(
      "sync",
      "/api/calendar/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      },
      "Der Abgleich konnte nicht gestartet werden.",
      // The route answers 200 even when every feed failed — the failures
      // are counted in the body. Reporting success here would be the one
      // lie this screen exists to prevent.
      (body) => {
        const summary = body as { errors?: number; newEvents?: number; removedEvents?: number } | null;
        const errors = typeof summary?.errors === "number" ? summary.errors : 0;
        if (errors > 0) {
          setError(
            errors === 1
              ? "Ein Portal hat beim Abgleich nicht geantwortet. Status siehe oben."
              : `${errors} Portale haben beim Abgleich nicht geantwortet. Status siehe oben.`,
          );
          router.refresh();
          return null;
        }
        const changed = (summary?.newEvents ?? 0) + (summary?.removedEvents ?? 0);
        return changed > 0
          ? `Abgleich gelaufen, ${changed} Änderungen übernommen.`
          : "Abgleich gelaufen, nichts Neues.";
      },
    );
  }

  function save(): void {
    const result = validateMobilePropertySettings({
      minNights: nights,
      checkInTime: checkIn,
      checkOutTime: checkOut,
    });
    if (!result.ok) {
      setError(result.error);
      setDone(null);
      return;
    }
    // Send only what this screen actually changed. Sending all three
    // would push the values loaded when the screen opened back over
    // anything edited on the desktop in the meantime.
    const patch: Record<string, unknown> = {};
    if (result.patch.minNights !== minNights) patch.minNights = result.patch.minNights;
    if (result.patch.checkInTime !== checkInTime) patch.checkInTime = result.patch.checkInTime;
    if (result.patch.checkOutTime !== checkOutTime) patch.checkOutTime = result.patch.checkOutTime;
    if (Object.keys(patch).length === 0) {
      setError(null);
      setDone("Nichts geändert.");
      return;
    }
    void run(
      "save",
      `/api/properties/${propertyId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
      "Die Einstellungen konnten nicht gespeichert werden.",
      () => "Gespeichert. Die Portale bekommen es beim nächsten Abruf.",
    );
  }

  return (
    <section aria-labelledby="property-tools-heading" className="space-y-3">
      <h3 id="property-tools-heading" className="text-lg font-semibold tracking-tight">
        Unterkunft
      </h3>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}
      {done && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {done}
        </p>
      )}

      <button
        type="button"
        onClick={syncNow}
        disabled={pending !== null}
        className={`${BUTTON} border border-[var(--zf-border)] dark:border-slate-800`}
      >
        {pending === "sync" ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw aria-hidden className="h-4 w-4" />
        )}
        Kalender jetzt abgleichen
      </button>

      <div className="space-y-3 rounded-2xl border border-[var(--zf-border)] bg-[var(--zf-bg)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium">
          Mindestnächte
          <input
            inputMode="numeric"
            value={nights}
            onChange={(event) => setNights(event.target.value)}
            className={FIELD}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Check-in ab
            <input
              type="time"
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className={FIELD}
            />
          </label>
          <label className="block text-sm font-medium">
            Check-out bis
            <input
              type="time"
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className={FIELD}
            />
          </label>
        </div>
        <p className="text-xs text-[var(--zf-text-muted)] dark:text-slate-400">
          Diese Werte gehen in den Kalender-Export und damit an Airbnb und Booking. Preise, Kanäle
          und Feed-Adressen bleiben im Dashboard.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={pending !== null}
          className={`${BUTTON} bg-[var(--zf-brand-dark)] text-[var(--zf-on-brand)] dark:bg-white dark:text-slate-950`}
        >
          {pending === "save" ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <Save aria-hidden className="h-4 w-4" />
          )}
          Speichern
        </button>
      </div>
    </section>
  );
}
