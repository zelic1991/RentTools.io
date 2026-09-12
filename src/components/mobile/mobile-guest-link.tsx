"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { germanApiError } from "@/lib/mobile-api-errors";
import {
  describeGuestLink,
  type MobileGuestLinkState,
  type MobileGuestLinkSubmission,
} from "@/lib/mobile-guest-link-core";

/**
 * Sending the pre-arrival form used to need the desktop: the phone only
 * showed that guest data was missing. Now the host can confirm the
 * traveler count, mint the link and hand it to the guest from the same
 * screen — the one place where they notice the data is missing.
 */

const STATE_LABEL: Record<MobileGuestLinkState, string> = {
  none: "Noch kein Link erstellt",
  waiting: "Link erstellt, Gast hat noch nicht ausgefüllt",
  submitted: "Vom Gast ausgefüllt",
  expired: "Link abgelaufen",
  revoked: "Link zurückgezogen",
  unavailable: "Link vorhanden, aber hier nicht lesbar",
};

const BUTTON =
  "flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60";
const SECONDARY = `${BUTTON} border border-[var(--zf-border)] dark:border-slate-800`;
const PRIMARY = `${BUTTON} bg-[var(--zf-brand-dark)] text-[var(--zf-on-brand)] dark:bg-white dark:text-slate-950`;

export function MobileGuestLink({
  reservationId,
  guestName,
  bookedGuestCount,
  canWrite,
}: {
  reservationId: number;
  guestName: string;
  bookedGuestCount: number | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submission, setSubmission] = useState<MobileGuestLinkSubmission | null>(null);
  const [count, setCount] = useState(bookedGuestCount ? String(bookedGuestCount) : "");
  const [copied, setCopied] = useState(false);

  const link = describeGuestLink(submission, new Date().toISOString());
  // Client components are also rendered on the server for the first
  // paint, where `window` does not exist.
  const absolute = submission?.shareUrl && typeof window !== "undefined"
    ? new URL(submission.shareUrl, window.location.origin).toString()
    : null;

  async function call<T>(url: string, init?: RequestInit): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(germanApiError(body?.error, "Das hat nicht geklappt. Bitte noch einmal versuchen."));
        return null;
      }
      return body as T;
    } catch {
      setError("Keine Verbindung. Bitte noch einmal versuchen.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function load(): Promise<void> {
    setOpen(true);
    if (loaded) return;
    const body = await call<{ submission: MobileGuestLinkSubmission | null }>(
      `/api/reservations/${reservationId}/guest-form/share`,
    );
    if (body) {
      setSubmission(body.submission);
      setLoaded(true);
    }
  }

  async function createLink(): Promise<void> {
    const trimmed = count.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      setError("Gästezahl bitte als ganze Zahl eintragen.");
      return;
    }
    if (parsed !== null && parsed !== bookedGuestCount) {
      const saved = await call(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookedGuestCount: parsed }),
      });
      if (!saved) return;
      router.refresh();
    }
    const body = await call<MobileGuestLinkSubmission>(
      `/api/reservations/${reservationId}/guest-form/share`,
      { method: "POST" },
    );
    if (body) {
      setSubmission(body);
      setLoaded(true);
    }
  }

  async function copy(): Promise<void> {
    if (!absolute) return;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopieren hat nicht geklappt. Link bitte lange antippen und kopieren.");
    }
  }

  async function share(): Promise<void> {
    if (!absolute) return;
    if (!navigator.share) {
      void copy();
      return;
    }
    try {
      await navigator.share({
        title: "Anreiseformular",
        text: `Anmeldung für euren Aufenthalt (${guestName})`,
        url: absolute,
      });
    } catch {
      // The share sheet was dismissed — nothing to report.
    }
  }

  if (!canWrite) {
    return (
      <p className="mt-4 rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-center text-xs text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
        Support-Ansicht ist schreibgeschützt.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => void load()} className={`${SECONDARY} mt-4 w-full`}>
        <Link2 aria-hidden className="h-4 w-4" /> Anreiseformular
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-surface)]/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-xs font-medium text-[var(--zf-text-muted)] dark:text-slate-400">
        {busy && !loaded ? "Wird geladen …" : STATE_LABEL[link.state]}
      </p>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}

      {link.canShare && absolute && (
        <>
          <p className="break-all rounded-xl bg-[var(--zf-bg)] px-3 py-2 text-xs text-[var(--zf-text-muted)] dark:bg-slate-900 dark:text-slate-300">
            {absolute}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void copy()} className={SECONDARY}>
              {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
            <button type="button" onClick={() => void share()} className={PRIMARY}>
              <Share2 aria-hidden className="h-4 w-4" /> Senden
            </button>
          </div>
        </>
      )}

      {(link.state === "none" || link.state === "expired" || link.state === "revoked") && loaded && (
        <div className="space-y-2">
          <label className="block text-xs font-medium">
            Bestätigte Gästezahl
            <input
              inputMode="numeric"
              value={count}
              onChange={(event) => setCount(event.target.value)}
              placeholder="z. B. 4"
              className="mt-1 min-h-12 w-full rounded-xl border border-[var(--zf-control-border)] bg-[var(--zf-bg)] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <p className="text-[11px] text-[var(--zf-text-muted)] dark:text-slate-400">
            Ohne bestätigte Gästezahl gibt Airbnb oder Booking nicht her, für wie viele Personen der
            Link gilt — die App verlangt sie deshalb vor dem Erstellen.
          </p>
          <button type="button" disabled={busy} onClick={() => void createLink()} className={`${PRIMARY} w-full`}>
            {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {link.state === "none" ? "Link erstellen" : "Neuen Link erstellen"}
          </button>
        </div>
      )}

      <button type="button" onClick={() => setOpen(false)} className={`${SECONDARY} w-full`}>
        Schließen
      </button>
    </div>
  );
}
