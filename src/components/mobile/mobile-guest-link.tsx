"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { localizedApiError } from "@/lib/mobile-api-errors";
import { useI18n } from "@/lib/i18n/context";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";
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

const COPY: CopyMap<{
  states: Record<MobileGuestLinkState, string>;
  genericError: string;
  noConnection: string;
  guestRange: string;
  copyFailed: string;
  formTitle: string;
  shareText: (guestName: string) => string;
  supportReadOnly: string;
  loading: string;
  copied: string;
  copy: string;
  send: string;
  confirmedCount: string;
  countPlaceholder: string;
  countHint: string;
  createLink: string;
  createNewLink: string;
  close: string;
}> = {
  en: {
    states: {
      none: "No link created yet",
      waiting: "Link created, guest has not filled it in yet",
      submitted: "Filled in by the guest",
      expired: "Link expired",
      revoked: "Link revoked",
      unavailable: "Link exists but cannot be read here",
    },
    genericError: "That didn't work. Please try again.",
    noConnection: "No connection. Please try again.",
    guestRange: "Please enter the number of guests as a whole number from 1 to 50.",
    copyFailed: "Copying didn't work. Please long-press the link and copy it.",
    formTitle: "Pre-arrival form",
    shareText: (name) => `Registration for your stay (${name})`,
    supportReadOnly: "Support view is read-only.",
    loading: "Loading …",
    copied: "Copied",
    copy: "Copy",
    send: "Send",
    confirmedCount: "Confirmed number of travelers",
    countPlaceholder: "e.g. 4",
    countHint:
      "Airbnb and Booking don't tell us how many people the link is for without a confirmed number of travelers — so the app asks for it before creating the link.",
    createLink: "Create link",
    createNewLink: "Create new link",
    close: "Close",
  },
  ru: {
    states: {
      none: "Ссылка ещё не создана",
      waiting: "Ссылка создана, гость ещё не заполнил анкету",
      submitted: "Заполнено гостем",
      expired: "Срок действия ссылки истёк",
      revoked: "Ссылка отозвана",
      unavailable: "Ссылка есть, но здесь её нельзя прочитать",
    },
    genericError: "Не получилось. Попробуйте ещё раз.",
    noConnection: "Нет соединения. Попробуйте ещё раз.",
    guestRange: "Введите количество гостей целым числом от 1 до 50.",
    copyFailed: "Не удалось скопировать. Нажмите на ссылку и удерживайте, чтобы скопировать её.",
    formTitle: "Анкета перед заездом",
    shareText: (name) => `Регистрация на ваше пребывание (${name})`,
    supportReadOnly: "Режим поддержки доступен только для чтения.",
    loading: "Загрузка …",
    copied: "Скопировано",
    copy: "Копировать",
    send: "Отправить",
    confirmedCount: "Подтверждённое количество гостей",
    countPlaceholder: "напр. 4",
    countHint:
      "Без подтверждённого количества гостей из Airbnb или Booking не видно, на сколько человек рассчитана ссылка, поэтому приложение запрашивает его перед созданием.",
    createLink: "Создать ссылку",
    createNewLink: "Создать новую ссылку",
    close: "Закрыть",
  },
  de: {
    states: {
      none: "Noch kein Link erstellt",
      waiting: "Link erstellt, Gast hat noch nicht ausgefüllt",
      submitted: "Vom Gast ausgefüllt",
      expired: "Link abgelaufen",
      revoked: "Link zurückgezogen",
      unavailable: "Link vorhanden, aber hier nicht lesbar",
    },
    genericError: "Das hat nicht geklappt. Bitte noch einmal versuchen.",
    noConnection: "Keine Verbindung. Bitte noch einmal versuchen.",
    guestRange: "Gästezahl bitte als ganze Zahl zwischen 1 und 50 eintragen.",
    copyFailed: "Kopieren hat nicht geklappt. Link bitte lange antippen und kopieren.",
    formTitle: "Anreiseformular",
    shareText: (name) => `Anmeldung für euren Aufenthalt (${name})`,
    supportReadOnly: "Support-Ansicht ist schreibgeschützt.",
    loading: "Wird geladen …",
    copied: "Kopiert",
    copy: "Kopieren",
    send: "Senden",
    confirmedCount: "Bestätigte Gästezahl",
    countPlaceholder: "z. B. 4",
    countHint:
      "Ohne bestätigte Gästezahl gibt Airbnb oder Booking nicht her, für wie viele Personen der Link gilt — die App verlangt sie deshalb vor dem Erstellen.",
    createLink: "Link erstellen",
    createNewLink: "Neuen Link erstellen",
    close: "Schließen",
  },
  fr: {
    states: {
      none: "Aucun lien créé pour l’instant",
      waiting: "Lien créé, le voyageur ne l’a pas encore rempli",
      submitted: "Rempli par le voyageur",
      expired: "Lien expiré",
      revoked: "Lien révoqué",
      unavailable: "Le lien existe, mais n’est pas lisible ici",
    },
    genericError: "Cela n’a pas fonctionné. Veuillez réessayer.",
    noConnection: "Pas de connexion. Veuillez réessayer.",
    guestRange: "Saisissez le nombre de voyageurs sous forme de nombre entier entre 1 et 50.",
    copyFailed: "La copie n’a pas fonctionné. Appuyez longuement sur le lien pour le copier.",
    formTitle: "Formulaire de pré-arrivée",
    shareText: (name) => `Enregistrement pour votre séjour (${name})`,
    supportReadOnly: "La vue support est en lecture seule.",
    loading: "Chargement …",
    copied: "Copié",
    copy: "Copier",
    send: "Envoyer",
    confirmedCount: "Nombre de voyageurs confirmé",
    countPlaceholder: "p. ex. 4",
    countHint:
      "Sans nombre de voyageurs confirmé, Airbnb ou Booking n’indiquent pas pour combien de personnes le lien est valable — l’application le demande donc avant de créer le lien.",
    createLink: "Créer le lien",
    createNewLink: "Créer un nouveau lien",
    close: "Fermer",
  },
  es: {
    states: {
      none: "Aún no se ha creado ningún enlace",
      waiting: "Enlace creado, el huésped aún no lo ha rellenado",
      submitted: "Rellenado por el huésped",
      expired: "Enlace caducado",
      revoked: "Enlace revocado",
      unavailable: "El enlace existe, pero no se puede leer aquí",
    },
    genericError: "No ha funcionado. Inténtalo de nuevo.",
    noConnection: "Sin conexión. Inténtalo de nuevo.",
    guestRange: "Introduce el número de huéspedes como número entero entre 1 y 50.",
    copyFailed: "No se pudo copiar. Mantén pulsado el enlace y cópialo.",
    formTitle: "Formulario previo a la llegada",
    shareText: (name) => `Registro para vuestra estancia (${name})`,
    supportReadOnly: "La vista de soporte es de solo lectura.",
    loading: "Cargando …",
    copied: "Copiado",
    copy: "Copiar",
    send: "Enviar",
    confirmedCount: "Número confirmado de viajeros",
    countPlaceholder: "p. ej. 4",
    countHint:
      "Sin un número confirmado de viajeros, Airbnb o Booking no indican para cuántas personas vale el enlace, por eso la app lo pide antes de crearlo.",
    createLink: "Crear enlace",
    createNewLink: "Crear nuevo enlace",
    close: "Cerrar",
  },
  hr: {
    states: {
      none: "Link još nije stvoren",
      waiting: "Link stvoren, gost još nije ispunio obrazac",
      submitted: "Gost je ispunio obrazac",
      expired: "Link je istekao",
      revoked: "Link opozvan",
      unavailable: "Link postoji, ali ovdje nije čitljiv",
    },
    genericError: "Nije uspjelo. Pokušajte ponovno.",
    noConnection: "Nema veze. Pokušajte ponovno.",
    guestRange: "Unesite broj gostiju kao cijeli broj od 1 do 50.",
    copyFailed: "Kopiranje nije uspjelo. Dugo pritisnite link i kopirajte ga.",
    formTitle: "Obrazac prije dolaska",
    shareText: (name) => `Prijava za vaš boravak (${name})`,
    supportReadOnly: "Prikaz podrške je samo za čitanje.",
    loading: "Učitavanje …",
    copied: "Kopirano",
    copy: "Kopiraj",
    send: "Pošalji",
    confirmedCount: "Potvrđeni broj putnika",
    countPlaceholder: "npr. 4",
    countHint:
      "Bez potvrđenog broja putnika Airbnb ili Booking ne otkrivaju za koliko osoba link vrijedi — zato ga aplikacija traži prije stvaranja linka.",
    createLink: "Stvori link",
    createNewLink: "Stvori novi link",
    close: "Zatvori",
  },
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
  const { locale } = useI18n();
  const text = resolveCopy(COPY, locale);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submission, setSubmission] = useState<MobileGuestLinkSubmission | null>(null);
  const [count, setCount] = useState(bookedGuestCount ? String(bookedGuestCount) : "");
  const [copied, setCopied] = useState(false);
  const [minting, setMinting] = useState(false);

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
        setError(localizedApiError(body?.error, locale, text.genericError));
        return null;
      }
      return body as T;
    } catch {
      setError(text.noConnection);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function load(): Promise<void> {
    setOpen(true);
    if (loaded) return;
    const body = await call<{ submission: MobileGuestLinkSubmission | null }>(
      `/api/reservations/${reservationId}/guest-form/share?view=link`,
    );
    if (body) {
      setSubmission(body.submission);
      setLoaded(true);
    }
  }

  async function createLink(): Promise<void> {
    // One flag for the whole errand. The count and the link are two
    // requests, and a gap between them let a second tap mint a second
    // valid link that the host would never see, let alone revoke.
    if (busy || minting) return;
    setMinting(true);
    try {
      await mintLink();
    } finally {
      setMinting(false);
    }
  }

  async function mintLink(): Promise<void> {
    const trimmed = count.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 50)) {
      setError(text.guestRange);
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
      setError(text.copyFailed);
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
        title: text.formTitle,
        text: text.shareText(guestName),
        url: absolute,
      });
    } catch {
      // The share sheet was dismissed — nothing to report.
    }
  }

  if (!canWrite) {
    return (
      <p className="mt-4 rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-center text-xs text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
        {text.supportReadOnly}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => void load()} className={`${SECONDARY} mt-4 w-full`}>
        <Link2 aria-hidden className="h-4 w-4" /> {text.formTitle}
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-surface)]/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-xs font-medium text-[var(--zf-text-muted)] dark:text-slate-400">
        {busy && !loaded ? text.loading : text.states[link.state]}
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
              {copied ? text.copied : text.copy}
            </button>
            <button type="button" onClick={() => void share()} className={PRIMARY}>
              <Share2 aria-hidden className="h-4 w-4" /> {text.send}
            </button>
          </div>
        </>
      )}

      {(link.state === "none" || link.state === "expired" || link.state === "revoked") && loaded && (
        <div className="space-y-2">
          <label className="block text-xs font-medium">
            {text.confirmedCount}
            <input
              inputMode="numeric"
              value={count}
              onChange={(event) => setCount(event.target.value)}
              placeholder={text.countPlaceholder}
              className="mt-1 min-h-12 w-full rounded-xl border border-[var(--zf-control-border)] bg-[var(--zf-bg)] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <p className="text-[11px] text-[var(--zf-text-muted)] dark:text-slate-400">
            {text.countHint}
          </p>
          <button
            type="button"
            disabled={busy || minting}
            onClick={() => void createLink()}
            className={`${PRIMARY} w-full`}
          >
            {(busy || minting) && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {link.state === "none" ? text.createLink : text.createNewLink}
          </button>
        </div>
      )}

      <button type="button" onClick={() => setOpen(false)} className={`${SECONDARY} w-full`}>
        {text.close}
      </button>
    </div>
  );
}
