"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { useI18n } from "@/lib/i18n/context";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

const COPY: CopyMap<{
  loadFailed: string;
  saveFailed: string;
  title: string;
  subtitle: string;
  property: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  back: string;
  saving: string;
  save: string;
}> = {
  en: {
    loadFailed: "Properties could not be loaded.",
    saveFailed: "The reservation could not be saved.",
    title: "New reservation",
    subtitle: "Enter the guest's details.",
    property: "Property",
    guestName: "Guest name",
    checkIn: "Arrival",
    checkOut: "Departure",
    back: "Back",
    saving: "Saving…",
    save: "Save reservation",
  },
  ru: {
    loadFailed: "Не удалось загрузить объекты.",
    saveFailed: "Не удалось сохранить бронирование.",
    title: "Новое бронирование",
    subtitle: "Введите данные гостя.",
    property: "Объект",
    guestName: "Имя гостя",
    checkIn: "Заезд",
    checkOut: "Выезд",
    back: "Назад",
    saving: "Сохранение…",
    save: "Сохранить бронирование",
  },
  de: {
    loadFailed: "Objekte konnten nicht geladen werden.",
    saveFailed: "Reservierung konnte nicht gespeichert werden.",
    title: "Neue Reservierung",
    subtitle: "Trage die Daten des Gastes ein.",
    property: "Unterkunft",
    guestName: "Name des Gastes",
    checkIn: "Anreise",
    checkOut: "Abreise",
    back: "Zurück",
    saving: "Speichern…",
    save: "Reservierung speichern",
  },
  fr: {
    loadFailed: "Les logements n’ont pas pu être chargés.",
    saveFailed: "La réservation n’a pas pu être enregistrée.",
    title: "Nouvelle réservation",
    subtitle: "Saisissez les informations du voyageur.",
    property: "Logement",
    guestName: "Nom du voyageur",
    checkIn: "Arrivée",
    checkOut: "Départ",
    back: "Retour",
    saving: "Enregistrement…",
    save: "Enregistrer la réservation",
  },
  es: {
    loadFailed: "No se pudieron cargar los alojamientos.",
    saveFailed: "No se pudo guardar la reserva.",
    title: "Nueva reserva",
    subtitle: "Introduce los datos del huésped.",
    property: "Alojamiento",
    guestName: "Nombre del huésped",
    checkIn: "Llegada",
    checkOut: "Salida",
    back: "Atrás",
    saving: "Guardando…",
    save: "Guardar reserva",
  },
  hr: {
    loadFailed: "Objekte nije bilo moguće učitati.",
    saveFailed: "Rezervaciju nije bilo moguće spremiti.",
    title: "Nova rezervacija",
    subtitle: "Unesite podatke gosta.",
    property: "Smještaj",
    guestName: "Ime gosta",
    checkIn: "Dolazak",
    checkOut: "Odlazak",
    back: "Natrag",
    saving: "Spremanje…",
    save: "Spremi rezervaciju",
  },
};

export default function FamilyReservationPage() {
  return <AuthGuard>{() => <FamilyReservationForm />}</AuthGuard>;
}

function FamilyReservationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useI18n();
  const copy = resolveCopy(COPY, locale);
  const [propertyId, setPropertyId] = useState(Number(params.get("property")) || 0);
  const [properties, setProperties] = useState<Array<{ id: number; name: string }>>([]);
  const [name, setName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then((items) => {
      const safe = Array.isArray(items) ? items : items.data ?? [];
      setProperties(safe);
      if (!propertyId && safe[0]) setPropertyId(safe[0].id);
    }).catch(() => setError(copy.loadFailed));
  }, [propertyId, copy.loadFailed]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    const response = await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId, name, checkIn, checkOut, platform: "direct" }) });
    if (!response.ok) { setError(copy.saveFailed); setSaving(false); return; }
    router.replace("/mobile");
  }

  return <main className="min-h-dvh bg-[#F9F4EF] p-4 text-[#2B241D] sm:p-8"><div className="mx-auto max-w-lg rounded-2xl bg-white p-5 shadow-sm"><h1 className="text-2xl font-semibold">{copy.title}</h1><p className="mt-1 text-sm text-[#685C4B]">{copy.subtitle}</p><form onSubmit={submit} className="mt-5 space-y-4">
    <label className="block text-sm font-medium">{copy.property}<select required value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] bg-white px-3">{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="block text-sm font-medium">{copy.guestName}<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] px-3" /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">{copy.checkIn}<input required type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] px-3" /></label><label className="block text-sm font-medium">{copy.checkOut}<input required type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] px-3" /></label></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" onClick={() => router.back()} className="min-h-12 flex-1 rounded-xl border border-[#D6C8AE]">{copy.back}</button><button disabled={saving} className="min-h-12 flex-1 rounded-xl bg-[#7B2E62] font-semibold text-[#F9F4EF]">{saving ? copy.saving : copy.save}</button></div>
  </form></div></main>;
}
