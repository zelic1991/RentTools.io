"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";

export default function FamilyReservationPage() {
  return <AuthGuard>{() => <FamilyReservationForm />}</AuthGuard>;
}

function FamilyReservationForm() {
  const router = useRouter();
  const params = useSearchParams();
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
    }).catch(() => setError("Objekte konnten nicht geladen werden."));
  }, [propertyId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    const response = await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId, name, checkIn, checkOut, platform: "direct" }) });
    if (!response.ok) { setError("Reservierung konnte nicht gespeichert werden."); setSaving(false); return; }
    router.replace("/mobile");
  }

  return <main className="min-h-dvh bg-[#F9F4EF] p-4 text-[#2B241D] sm:p-8"><div className="mx-auto max-w-lg rounded-2xl bg-white p-5 shadow-sm"><h1 className="text-2xl font-semibold">Neue Reservierung</h1><p className="mt-1 text-sm text-[#685C4B]">Trage die Daten des Gastes ein.</p><form onSubmit={submit} className="mt-5 space-y-4">
    <label className="block text-sm font-medium">Unterkunft<select required value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] bg-white px-3">{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="block text-sm font-medium">Name des Gastes<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] px-3" /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Dolazak<input required type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] px-3" /></label><label className="block text-sm font-medium">Odlazak<input required type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[#D6C8AE] px-3" /></label></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" onClick={() => router.back()} className="min-h-12 flex-1 rounded-xl border border-[#D6C8AE]">Zurück</button><button disabled={saving} className="min-h-12 flex-1 rounded-xl bg-[#7B2E62] font-semibold text-[#F9F4EF]">{saving ? "Speichern…" : "Reservierung speichern"}</button></div>
  </form></div></main>;
}
