"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { localizedApiError } from "@/lib/mobile-api-errors";
import { validateMobilePropertySettings } from "@/lib/mobile-property-settings-core";
import { useI18n } from "@/lib/i18n/context";
import { hrPlural, resolveCopy, type CopyMap } from "@/lib/i18n/translations";

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

/** Russian picks the noun form by the same 1 / 2-4 / 5+ ends-in-digit
 *  rule (teens excepted) as Croatian, so the helper fits both. */
const ruPlural = hrPlural;

const COPY: CopyMap<{
  noConnection: string;
  syncFailed: string;
  portalsNoAnswer: (n: number) => string;
  syncChanged: (n: number) => string;
  syncNothingNew: string;
  nothingChanged: string;
  saveFailed: string;
  saved: string;
  heading: string;
  syncNow: string;
  minNights: string;
  checkInFrom: string;
  checkOutUntil: string;
  hint: string;
  save: string;
}> = {
  en: {
    noConnection: "No connection. Please try again.",
    syncFailed: "The sync could not be started.",
    portalsNoAnswer: (n) =>
      n === 1
        ? "One portal did not respond during the sync. See the status above."
        : `${n} portals did not respond during the sync. See the status above.`,
    syncChanged: (n) => `Sync done, ${n} ${n === 1 ? "change" : "changes"} applied.`,
    syncNothingNew: "Sync done, nothing new.",
    nothingChanged: "Nothing changed.",
    saveFailed: "The settings could not be saved.",
    saved: "Saved. The portals get it with their next fetch.",
    heading: "Property",
    syncNow: "Sync calendars now",
    minNights: "Minimum nights",
    checkInFrom: "Check-in from",
    checkOutUntil: "Check-out until",
    hint: "These values go into the calendar export and so to Airbnb and Booking. Prices, channels and feed addresses stay in the dashboard.",
    save: "Save",
  },
  ru: {
    noConnection: "Нет соединения. Попробуйте ещё раз.",
    syncFailed: "Не удалось запустить синхронизацию.",
    portalsNoAnswer: (n) =>
      n === 1
        ? "Один портал не ответил при синхронизации. Статус см. выше."
        : `${n} ${ruPlural(n, "портал", "портала", "порталов")} не ответили при синхронизации. Статус см. выше.`,
    syncChanged: (n) => `Синхронизация выполнена, применено изменений: ${n}.`,
    syncNothingNew: "Синхронизация выполнена, ничего нового.",
    nothingChanged: "Ничего не изменено.",
    saveFailed: "Не удалось сохранить настройки.",
    saved: "Сохранено. Порталы получат это при следующем запросе.",
    heading: "Объект",
    syncNow: "Синхронизировать календари сейчас",
    minNights: "Минимум ночей",
    checkInFrom: "Заезд с",
    checkOutUntil: "Выезд до",
    hint: "Эти значения попадают в экспорт календаря, а значит, в Airbnb и Booking. Цены, каналы и адреса фидов остаются в панели управления.",
    save: "Сохранить",
  },
  de: {
    noConnection: "Keine Verbindung. Bitte noch einmal versuchen.",
    syncFailed: "Der Abgleich konnte nicht gestartet werden.",
    portalsNoAnswer: (n) =>
      n === 1
        ? "Ein Portal hat beim Abgleich nicht geantwortet. Status siehe oben."
        : `${n} Portale haben beim Abgleich nicht geantwortet. Status siehe oben.`,
    syncChanged: (n) => `Abgleich gelaufen, ${n} Änderungen übernommen.`,
    syncNothingNew: "Abgleich gelaufen, nichts Neues.",
    nothingChanged: "Nichts geändert.",
    saveFailed: "Die Einstellungen konnten nicht gespeichert werden.",
    saved: "Gespeichert. Die Portale bekommen es beim nächsten Abruf.",
    heading: "Unterkunft",
    syncNow: "Kalender jetzt abgleichen",
    minNights: "Mindestnächte",
    checkInFrom: "Check-in ab",
    checkOutUntil: "Check-out bis",
    hint: "Diese Werte gehen in den Kalender-Export und damit an Airbnb und Booking. Preise, Kanäle und Feed-Adressen bleiben im Dashboard.",
    save: "Speichern",
  },
  fr: {
    noConnection: "Pas de connexion. Veuillez réessayer.",
    syncFailed: "La synchronisation n’a pas pu être lancée.",
    portalsNoAnswer: (n) =>
      n === 1
        ? "Un portail n’a pas répondu pendant la synchronisation. Voir l’état ci-dessus."
        : `${n} portails n’ont pas répondu pendant la synchronisation. Voir l’état ci-dessus.`,
    syncChanged: (n) => `Synchronisation effectuée, ${n} modification${n === 1 ? "" : "s"} appliquée${n === 1 ? "" : "s"}.`,
    syncNothingNew: "Synchronisation effectuée, rien de nouveau.",
    nothingChanged: "Rien n’a changé.",
    saveFailed: "Les paramètres n’ont pas pu être enregistrés.",
    saved: "Enregistré. Les portails le recevront lors de leur prochaine récupération.",
    heading: "Logement",
    syncNow: "Synchroniser les calendriers maintenant",
    minNights: "Nuits minimum",
    checkInFrom: "Arrivée à partir de",
    checkOutUntil: "Départ jusqu’à",
    hint: "Ces valeurs vont dans l’export du calendrier et donc vers Airbnb et Booking. Les prix, canaux et adresses de flux restent dans le tableau de bord.",
    save: "Enregistrer",
  },
  es: {
    noConnection: "Sin conexión. Inténtalo de nuevo.",
    syncFailed: "No se pudo iniciar la sincronización.",
    portalsNoAnswer: (n) =>
      n === 1
        ? "Un portal no respondió durante la sincronización. Consulta el estado arriba."
        : `${n} portales no respondieron durante la sincronización. Consulta el estado arriba.`,
    syncChanged: (n) => `Sincronización completada, ${n} ${n === 1 ? "cambio aplicado" : "cambios aplicados"}.`,
    syncNothingNew: "Sincronización completada, nada nuevo.",
    nothingChanged: "No ha cambiado nada.",
    saveFailed: "No se pudo guardar la configuración.",
    saved: "Guardado. Los portales lo recibirán en su próxima consulta.",
    heading: "Alojamiento",
    syncNow: "Sincronizar calendarios ahora",
    minNights: "Noches mínimas",
    checkInFrom: "Entrada desde",
    checkOutUntil: "Salida hasta",
    hint: "Estos valores van a la exportación del calendario y, por tanto, a Airbnb y Booking. Los precios, canales y direcciones de feed se quedan en el panel.",
    save: "Guardar",
  },
  hr: {
    noConnection: "Nema veze. Pokušajte ponovno.",
    syncFailed: "Sinkronizaciju nije bilo moguće pokrenuti.",
    portalsNoAnswer: (n) =>
      n === 1
        ? "Jedan portal nije odgovorio tijekom sinkronizacije. Status pogledajte gore."
        : `Broj portala koji nisu odgovorili tijekom sinkronizacije: ${n}. Status pogledajte gore.`,
    syncChanged: (n) => `Sinkronizacija je provedena, preuzeto promjena: ${n}.`,
    syncNothingNew: "Sinkronizacija je provedena, nema ništa novo.",
    nothingChanged: "Ništa nije promijenjeno.",
    saveFailed: "Postavke nije bilo moguće spremiti.",
    saved: "Spremljeno. Portali će to dobiti pri sljedećem dohvaćanju.",
    heading: "Smještaj",
    syncNow: "Sinkroniziraj kalendare sada",
    minNights: "Minimalan broj noćenja",
    checkInFrom: "Dolazak od",
    checkOutUntil: "Odlazak do",
    hint: "Ove vrijednosti ulaze u izvoz kalendara, a time i na Airbnb i Booking. Cijene, kanali i adrese feedova ostaju na nadzornoj ploči.",
    save: "Spremi",
  },
};

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
  const { locale } = useI18n();
  const copy = resolveCopy(COPY, locale);
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
        setError(localizedApiError((body as { error?: unknown } | null)?.error, locale, fallback));
        return;
      }
      const message = success(body);
      if (message === null) return;
      setDone(message);
      router.refresh();
    } catch {
      setError(copy.noConnection);
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
      copy.syncFailed,
      // The route answers 200 even when every feed failed — the failures
      // are counted in the body. Reporting success here would be the one
      // lie this screen exists to prevent.
      (body) => {
        const summary = body as { errors?: number; newEvents?: number; removedEvents?: number } | null;
        const errors = typeof summary?.errors === "number" ? summary.errors : 0;
        if (errors > 0) {
          setError(copy.portalsNoAnswer(errors));
          router.refresh();
          return null;
        }
        const changed = (summary?.newEvents ?? 0) + (summary?.removedEvents ?? 0);
        return changed > 0
          ? copy.syncChanged(changed)
          : copy.syncNothingNew;
      },
    );
  }

  function save(): void {
    const result = validateMobilePropertySettings({
      minNights: nights,
      checkInTime: checkIn,
      checkOutTime: checkOut,
    }, locale);
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
      setDone(copy.nothingChanged);
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
      copy.saveFailed,
      () => copy.saved,
    );
  }

  return (
    <section aria-labelledby="property-tools-heading" className="space-y-3">
      <h3 id="property-tools-heading" className="text-lg font-semibold tracking-tight">
        {copy.heading}
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
        {copy.syncNow}
      </button>

      <div className="space-y-3 rounded-2xl border border-[var(--zf-border)] bg-[var(--zf-bg)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium">
          {copy.minNights}
          <input
            inputMode="numeric"
            value={nights}
            onChange={(event) => setNights(event.target.value)}
            className={FIELD}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            {copy.checkInFrom}
            <input
              type="time"
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className={FIELD}
            />
          </label>
          <label className="block text-sm font-medium">
            {copy.checkOutUntil}
            <input
              type="time"
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className={FIELD}
            />
          </label>
        </div>
        <p className="text-xs text-[var(--zf-text-muted)] dark:text-slate-400">
          {copy.hint}
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
          {copy.save}
        </button>
      </div>
    </section>
  );
}
