"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { localizedApiError } from "@/lib/mobile-api-errors";
import { useI18n } from "@/lib/i18n/context";
import { mobileIntlTag } from "@/lib/i18n/mobile-locale";
import { resolveCopy, type CopyMap, type Locale } from "@/lib/i18n/translations";
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

interface SheetCopy {
  direct: string;
  other: string;
  actions: Record<MobileDayAction, string>;
  occupiedVia: (platform: string, from: string, to: string) => string;
  blocked: string;
  forcedOpen: string;
  buffer: string;
  cleaning: string;
  free: string;
  noConnection: string;
  enterName: string;
  checkOutAfterCheckIn: string;
  amountFormat: string;
  guestRange: string;
  unblockFailed: string;
  blockFailed: string;
  createFailed: string;
  saveFailed: string;
  deleteConfirm: (name: string) => string;
  deleteFailed: string;
  loadFailed: string;
  close: string;
  newDirect: string;
  editBooking: string;
  day: string;
  eventNote: (platform: string) => string;
  cleaningNote: string;
  bufferNote: string;
  readOnly: string;
  name: string;
  namePlaceholder: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  amount: string;
  optional: string;
  editHint: string;
  createHint: string;
  back: string;
  createBooking: string;
  save: string;
  /** Whether a stored amount is put back into the field with a decimal comma. */
  decimalComma: boolean;
}

const COPY: CopyMap<SheetCopy> = {
  en: {
    direct: "Direct",
    other: "Other",
    actions: {
      create: "Add direct booking",
      block: "Block day",
      unblock: "Remove block",
      edit: "Edit booking",
      delete: "Delete booking",
    },
    occupiedVia: (p, from, to) => `Occupied via ${p} · ${from}–${to}`,
    blocked: "Blocked, not bookable",
    forcedOpen: "Opened manually",
    buffer: "Buffer day from the channel settings",
    cleaning: "Cleaning scheduled",
    free: "Free",
    noConnection: "No connection. Please try again.",
    enterName: "Please enter a name.",
    checkOutAfterCheckIn: "Check-out must be after check-in.",
    amountFormat: "Please enter the amount as a number, for example 162.80.",
    guestRange: "Please enter the number of guests as a whole number from 1 to 50.",
    unblockFailed: "The block could not be removed.",
    blockFailed: "The day could not be blocked.",
    createFailed: "The booking could not be created.",
    saveFailed: "The change could not be saved.",
    deleteConfirm: (name) => `Really delete the booking "${name}"?`,
    deleteFailed: "The booking could not be deleted.",
    loadFailed: "The stored values could not be loaded.",
    close: "Close",
    newDirect: "New direct booking",
    editBooking: "Edit booking",
    day: "Day",
    eventNote: (p) => `This booking comes from ${p} and is changed there.`,
    cleaningNote:
      "A cleaning is scheduled for this day. Blocking is not possible here, because it would replace the cleaning and report the day to the portals as occupied. A booking keeps the cleaning.",
    bufferNote: "The buffer keeps the day free on the portals. The app still accepts a direct booking here.",
    readOnly: "This view is read-only.",
    name: "Name",
    namePlaceholder: "Who is coming?",
    checkIn: "Check-in",
    checkOut: "Check-out",
    guests: "Guests",
    amount: "Amount (€)",
    optional: "optional",
    editHint: "The fields show what is stored. If you empty one, the value is deleted.",
    createHint: "The amount counts in the reports. Without an amount the booking stays there without a total.",
    back: "Back",
    createBooking: "Create booking",
    save: "Save",
    decimalComma: false,
  },
  ru: {
    direct: "Напрямую",
    other: "Другое",
    actions: {
      create: "Добавить прямое бронирование",
      block: "Заблокировать день",
      unblock: "Снять блокировку",
      edit: "Изменить бронирование",
      delete: "Удалить бронирование",
    },
    occupiedVia: (p, from, to) => `Занято через ${p} · ${from}–${to}`,
    blocked: "Заблокировано, бронирование невозможно",
    forcedOpen: "Открыто вручную",
    buffer: "Буферный день из настроек канала",
    cleaning: "Запланирована уборка",
    free: "Свободно",
    noConnection: "Нет соединения. Попробуйте ещё раз.",
    enterName: "Пожалуйста, введите имя.",
    checkOutAfterCheckIn: "Дата выезда должна быть позже даты заезда.",
    amountFormat: "Введите сумму числом, например 162,80.",
    guestRange: "Введите количество гостей целым числом от 1 до 50.",
    unblockFailed: "Не удалось снять блокировку.",
    blockFailed: "Не удалось заблокировать день.",
    createFailed: "Не удалось создать бронирование.",
    saveFailed: "Не удалось сохранить изменение.",
    deleteConfirm: (name) => `Действительно удалить бронирование «${name}»?`,
    deleteFailed: "Не удалось удалить бронирование.",
    loadFailed: "Не удалось загрузить сохранённые значения.",
    close: "Закрыть",
    newDirect: "Новое прямое бронирование",
    editBooking: "Изменить бронирование",
    day: "День",
    eventNote: (p) => `Это бронирование пришло из ${p} и изменяется там.`,
    cleaningNote:
      "На этот день запланирована уборка. Заблокировать его здесь нельзя: блокировка заменила бы уборку и сообщила бы порталам, что день занят. Бронирование уборку сохраняет.",
    bufferNote: "Буфер держит день свободным на порталах. Прямое бронирование приложение здесь всё равно принимает.",
    readOnly: "Этот вид доступен только для чтения.",
    name: "Имя",
    namePlaceholder: "Кто приезжает?",
    checkIn: "Заезд",
    checkOut: "Выезд",
    guests: "Гости",
    amount: "Сумма (€)",
    optional: "необязательно",
    editHint: "В полях показано то, что сохранено. Если очистить поле, значение будет удалено.",
    createHint: "Сумма учитывается в отчётах. Без суммы бронирование будет там без итога.",
    back: "Назад",
    createBooking: "Создать бронирование",
    save: "Сохранить",
    decimalComma: true,
  },
  de: {
    direct: "Direkt",
    other: "Sonstige",
    actions: {
      create: "Direktbuchung anlegen",
      block: "Tag sperren",
      unblock: "Sperre aufheben",
      edit: "Buchung bearbeiten",
      delete: "Buchung löschen",
    },
    occupiedVia: (p, from, to) => `Belegt über ${p} · ${from}–${to}`,
    blocked: "Gesperrt, nicht buchbar",
    forcedOpen: "Manuell freigegeben",
    buffer: "Puffertag aus den Kanal-Einstellungen",
    cleaning: "Reinigung geplant",
    free: "Frei",
    noConnection: "Keine Verbindung. Bitte noch einmal versuchen.",
    enterName: "Bitte einen Namen eintragen.",
    checkOutAfterCheckIn: "Die Abreise muss nach der Anreise liegen.",
    amountFormat: "Betrag bitte als Zahl eintragen, zum Beispiel 162,80.",
    guestRange: "Gästezahl bitte als ganze Zahl zwischen 1 und 50 eintragen.",
    unblockFailed: "Die Sperre konnte nicht aufgehoben werden.",
    blockFailed: "Der Tag konnte nicht gesperrt werden.",
    createFailed: "Die Buchung konnte nicht angelegt werden.",
    saveFailed: "Die Änderung konnte nicht gespeichert werden.",
    deleteConfirm: (name) => `Buchung "${name}" wirklich löschen?`,
    deleteFailed: "Die Buchung konnte nicht gelöscht werden.",
    loadFailed: "Die gespeicherten Werte konnten nicht geladen werden.",
    close: "Schließen",
    newDirect: "Neue Direktbuchung",
    editBooking: "Buchung bearbeiten",
    day: "Tag",
    eventNote: (p) => `Diese Buchung kommt von ${p} und wird dort geändert.`,
    cleaningNote:
      "Für diesen Tag ist eine Reinigung eingeplant. Sperren geht hier nicht, weil das die Reinigung ersetzen und den Tag an die Portale als belegt melden würde. Eine Buchung lässt die Reinigung stehen.",
    bufferNote: "Der Puffer hält den Tag auf den Portalen frei. Eine Direktbuchung nimmt die App hier trotzdem an.",
    readOnly: "Diese Ansicht ist schreibgeschützt.",
    name: "Name",
    namePlaceholder: "Wer kommt?",
    checkIn: "Anreise",
    checkOut: "Abreise",
    guests: "Gäste",
    amount: "Betrag (€)",
    optional: "optional",
    editHint: "Die Felder zeigen, was gespeichert ist. Leerst du eines, wird der Wert gelöscht.",
    createHint: "Der Betrag zählt in den Berichten. Ohne Betrag bleibt die Buchung dort ohne Summe.",
    back: "Zurück",
    createBooking: "Buchung anlegen",
    save: "Speichern",
    decimalComma: true,
  },
  fr: {
    direct: "Direct",
    other: "Autre",
    actions: {
      create: "Créer une réservation directe",
      block: "Bloquer le jour",
      unblock: "Lever le blocage",
      edit: "Modifier la réservation",
      delete: "Supprimer la réservation",
    },
    occupiedVia: (p, from, to) => `Occupé via ${p} · ${from}–${to}`,
    blocked: "Bloqué, non réservable",
    forcedOpen: "Ouvert manuellement",
    buffer: "Jour tampon issu des paramètres du canal",
    cleaning: "Ménage prévu",
    free: "Libre",
    noConnection: "Pas de connexion. Veuillez réessayer.",
    enterName: "Veuillez saisir un nom.",
    checkOutAfterCheckIn: "Le départ doit être postérieur à l’arrivée.",
    amountFormat: "Saisissez le montant sous forme de nombre, par exemple 162,80.",
    guestRange: "Saisissez le nombre de voyageurs sous forme de nombre entier entre 1 et 50.",
    unblockFailed: "Le blocage n’a pas pu être levé.",
    blockFailed: "Le jour n’a pas pu être bloqué.",
    createFailed: "La réservation n’a pas pu être créée.",
    saveFailed: "La modification n’a pas pu être enregistrée.",
    deleteConfirm: (name) => `Supprimer vraiment la réservation « ${name} » ?`,
    deleteFailed: "La réservation n’a pas pu être supprimée.",
    loadFailed: "Les valeurs enregistrées n’ont pas pu être chargées.",
    close: "Fermer",
    newDirect: "Nouvelle réservation directe",
    editBooking: "Modifier la réservation",
    day: "Jour",
    eventNote: (p) => `Cette réservation provient de ${p} et se modifie là-bas.`,
    cleaningNote:
      "Un ménage est prévu ce jour-là. Le blocage n’est pas possible ici, car il remplacerait le ménage et signalerait le jour comme occupé aux portails. Une réservation conserve le ménage.",
    bufferNote: "Le tampon garde le jour libre sur les portails. L’application accepte quand même une réservation directe ici.",
    readOnly: "Cette vue est en lecture seule.",
    name: "Nom",
    namePlaceholder: "Qui arrive ?",
    checkIn: "Arrivée",
    checkOut: "Départ",
    guests: "Voyageurs",
    amount: "Montant (€)",
    optional: "facultatif",
    editHint: "Les champs affichent ce qui est enregistré. Si vous en videz un, la valeur est supprimée.",
    createHint: "Le montant compte dans les rapports. Sans montant, la réservation y reste sans total.",
    back: "Retour",
    createBooking: "Créer la réservation",
    save: "Enregistrer",
    decimalComma: true,
  },
  es: {
    direct: "Directa",
    other: "Otros",
    actions: {
      create: "Crear reserva directa",
      block: "Bloquear día",
      unblock: "Quitar bloqueo",
      edit: "Editar reserva",
      delete: "Eliminar reserva",
    },
    occupiedVia: (p, from, to) => `Ocupado a través de ${p} · ${from}–${to}`,
    blocked: "Bloqueado, no reservable",
    forcedOpen: "Abierto manualmente",
    buffer: "Día tampón de la configuración del canal",
    cleaning: "Limpieza programada",
    free: "Libre",
    noConnection: "Sin conexión. Inténtalo de nuevo.",
    enterName: "Introduce un nombre.",
    checkOutAfterCheckIn: "La salida debe ser posterior a la llegada.",
    amountFormat: "Introduce el importe como número, por ejemplo 162,80.",
    guestRange: "Introduce el número de huéspedes como número entero entre 1 y 50.",
    unblockFailed: "No se pudo quitar el bloqueo.",
    blockFailed: "No se pudo bloquear el día.",
    createFailed: "No se pudo crear la reserva.",
    saveFailed: "No se pudo guardar el cambio.",
    deleteConfirm: (name) => `¿Seguro que quieres eliminar la reserva «${name}»?`,
    deleteFailed: "No se pudo eliminar la reserva.",
    loadFailed: "No se pudieron cargar los valores guardados.",
    close: "Cerrar",
    newDirect: "Nueva reserva directa",
    editBooking: "Editar reserva",
    day: "Día",
    eventNote: (p) => `Esta reserva viene de ${p} y se modifica allí.`,
    cleaningNote:
      "Hay una limpieza programada para este día. Aquí no se puede bloquear, porque eso sustituiría la limpieza y comunicaría el día a los portales como ocupado. Una reserva mantiene la limpieza.",
    bufferNote: "El tampón mantiene el día libre en los portales. Aun así, la app acepta aquí una reserva directa.",
    readOnly: "Esta vista es de solo lectura.",
    name: "Nombre",
    namePlaceholder: "¿Quién viene?",
    checkIn: "Llegada",
    checkOut: "Salida",
    guests: "Huéspedes",
    amount: "Importe (€)",
    optional: "opcional",
    editHint: "Los campos muestran lo que está guardado. Si vacías uno, el valor se elimina.",
    createHint: "El importe cuenta en los informes. Sin importe, la reserva aparece allí sin total.",
    back: "Atrás",
    createBooking: "Crear reserva",
    save: "Guardar",
    decimalComma: true,
  },
  hr: {
    direct: "Izravno",
    other: "Ostalo",
    actions: {
      create: "Dodaj izravnu rezervaciju",
      block: "Blokiraj dan",
      unblock: "Ukloni blokadu",
      edit: "Uredi rezervaciju",
      delete: "Obriši rezervaciju",
    },
    occupiedVia: (p, from, to) => `Zauzeto preko ${p} · ${from}–${to}`,
    blocked: "Blokirano, nije moguće rezervirati",
    forcedOpen: "Ručno otvoreno",
    buffer: "Dan pauze iz postavki kanala",
    cleaning: "Čišćenje zakazano",
    free: "Slobodno",
    noConnection: "Nema veze. Pokušajte ponovno.",
    enterName: "Unesite ime.",
    checkOutAfterCheckIn: "Odlazak mora biti nakon dolaska.",
    amountFormat: "Unesite iznos kao broj, na primjer 162,80.",
    guestRange: "Unesite broj gostiju kao cijeli broj od 1 do 50.",
    unblockFailed: "Blokadu nije bilo moguće ukloniti.",
    blockFailed: "Dan nije bilo moguće blokirati.",
    createFailed: "Rezervaciju nije bilo moguće stvoriti.",
    saveFailed: "Promjenu nije bilo moguće spremiti.",
    deleteConfirm: (name) => `Stvarno obrisati rezervaciju „${name}”?`,
    deleteFailed: "Rezervaciju nije bilo moguće obrisati.",
    loadFailed: "Spremljene vrijednosti nije bilo moguće učitati.",
    close: "Zatvori",
    newDirect: "Nova izravna rezervacija",
    editBooking: "Uredi rezervaciju",
    day: "Dan",
    eventNote: (p) => `Ova rezervacija dolazi s platforme ${p} i mijenja se ondje.`,
    cleaningNote:
      "Za ovaj je dan zakazano čišćenje. Blokiranje ovdje nije moguće jer bi zamijenilo čišćenje i portalima prijavilo dan kao zauzet. Rezervacija zadržava čišćenje.",
    bufferNote: "Pauza drži dan slobodnim na portalima. Aplikacija ovdje ipak prihvaća izravnu rezervaciju.",
    readOnly: "Ovaj je prikaz samo za čitanje.",
    name: "Ime",
    namePlaceholder: "Tko dolazi?",
    checkIn: "Dolazak",
    checkOut: "Odlazak",
    guests: "Gosti",
    amount: "Iznos (€)",
    optional: "neobavezno",
    editHint: "Polja prikazuju ono što je spremljeno. Ako neko ispraznite, vrijednost se briše.",
    createHint: "Iznos se računa u izvješćima. Bez iznosa rezervacija ondje ostaje bez zbroja.",
    back: "Natrag",
    createBooking: "Stvori rezervaciju",
    save: "Spremi",
    decimalComma: true,
  },
};

const FIELD_CLASS =
  "mt-1 min-h-12 w-full rounded-xl border border-[var(--zf-control-border)] bg-[var(--zf-bg)] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-700 dark:bg-slate-950";

interface ReservationDetails {
  id: number;
  bookedGuestCount: number | null;
  grossAmountCents: number | null;
}

function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(mobileIntlTag(locale), {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function platformLabel(platform: string, copy: SheetCopy): string {
  const key = platform.toLowerCase();
  if (key === "airbnb") return "Airbnb";
  if (key === "booking") return "Booking.com";
  if (key === "direct") return copy.direct;
  if (key === "other") return copy.other;
  return platform;
}

function nextDay(date: string): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function centsToInput(cents: number | null, decimalComma: boolean): string {
  if (cents === null) return "";
  const fixed = (cents / 100).toFixed(2);
  return decimalComma ? fixed.replace(".", ",") : fixed;
}

function stateLine(state: MobileDayState, copy: SheetCopy): string {
  switch (state.kind) {
    case "reservation":
      return `${state.reservation.name} · ${state.reservation.checkIn.slice(0, 10)}–${state.reservation.checkOut.slice(0, 10)} · ${platformLabel(state.reservation.platform, copy)}`;
    case "event":
      return copy.occupiedVia(platformLabel(state.platform, copy), state.startDate, state.endDate);
    case "blocked":
      return copy.blocked;
    case "forced-open":
      return copy.forcedOpen;
    case "buffer":
      return copy.buffer;
    case "cleaning":
      return copy.cleaning;
    default:
      return copy.free;
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
  const { locale } = useI18n();
  const copy = resolveCopy(COPY, locale);
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
        const message = localizedApiError(body?.error, locale, fallback);
        const existing = body?.existing && typeof body.existing.name === "string"
          ? ` (${body.existing.name}, ${String(body.existing.checkIn).slice(0, 10)}–${String(body.existing.checkOut).slice(0, 10)})`
          : "";
        setError(`${message}${existing}`);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError(copy.noConnection);
    } finally {
      setPending(null);
    }
  }

  function buildBody(): Record<string, unknown> | null {
    if (!name.trim()) {
      setError(copy.enterName);
      return null;
    }
    if (checkOut <= checkIn) {
      setError(copy.checkOutAfterCheckIn);
      return null;
    }
    const parsed = parseGrossAmountText(amount);
    if (!parsed.ok) {
      setError(copy.amountFormat);
      return null;
    }
    const trimmedGuests = guests.trim();
    const guestCount = trimmedGuests === "" ? null : Number(trimmedGuests);
    if (guestCount !== null && (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 50)) {
      // Same range the server enforces, so the phone does not promise
      // something the API will refuse.
      setError(copy.guestRange);
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
      void send("unblock", remove, { method: "DELETE" }, copy.unblockFailed);
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
        copy.blockFailed,
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
        copy.createFailed,
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
      copy.saveFailed,
    );
  }

  function remove(): void {
    if (!booked) return;
    if (!window.confirm(copy.deleteConfirm(booked.name))) return;
    void send(
      "delete",
      `/api/reservations/${booked.id}`,
      { method: "DELETE" },
      copy.deleteFailed,
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
      const response = await fetch(`/api/reservations/${booked.id}`);
      const row: ReservationDetails | null = response.ok ? await response.json() : null;
      if (!row || row.id !== booked.id) {
        setError(copy.loadFailed);
        return;
      }
      setGuests(row.bookedGuestCount === null ? "" : String(row.bookedGuestCount));
      setAmount(centsToInput(row.grossAmountCents, copy.decimalComma));
      setMode("edit");
    } catch {
      setError(copy.noConnection);
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
      <button type="button" aria-label={copy.close} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={formatDay(date, locale)}
        tabIndex={-1}
        className="relative max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--zf-brand)]">
              {mode === "create" ? copy.newDirect : mode === "edit" ? copy.editBooking : copy.day}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{formatDay(date, locale)}</h2>
            <p className="mt-1 text-sm text-[var(--zf-text-muted)] dark:text-slate-400">{stateLine(state, copy)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
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
                {copy.eventNote(platformLabel(state.platform, copy))}
              </p>
            )}
            {state.kind === "cleaning" && (
              <p className="rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
                {copy.cleaningNote}
              </p>
            )}
            {state.kind === "buffer" && (
              <p className="rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
                {copy.bufferNote}
              </p>
            )}
            {actions.length === 0 && state.kind !== "event" && (
              <p className="rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
                {copy.readOnly}
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
                {copy.actions[action]}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              {copy.name}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.namePlaceholder}
                className={FIELD_CLASS}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                {copy.checkIn}
                <input
                  type="date"
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block text-sm font-medium">
                {copy.checkOut}
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
                {copy.guests}
                <input
                  inputMode="numeric"
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                  placeholder={copy.optional}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block text-sm font-medium">
                {copy.amount}
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={copy.optional}
                  className={FIELD_CLASS}
                />
              </label>
            </div>
            <p className="text-xs text-[var(--zf-text-muted)] dark:text-slate-400">
              {mode === "edit"
                ? copy.editHint
                : copy.createHint}
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
                {copy.back}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending !== null}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--zf-brand-dark)] text-sm font-semibold text-[var(--zf-on-brand)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {pending === "save" && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                {mode === "create" ? copy.createBooking : copy.save}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
