"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { hrPlural, resolveCopy, type CopyMap } from "@/lib/i18n/translations";
import type { Guest } from "@/lib/types";

/** Russian picks the noun form by the same 1 / 2-4 / 5+ ends-in-digit
 *  rule (teens excepted) as Croatian, so the helper fits both. */
const ruPlural = hrPlural;

interface CopyShape {
  saving: string;
  saved: string;
  copy: string;
  copied: string;
  save: string;
  cancel: string;
  editGuest: string;
  deleteGuest: string;
  confirmDelete: string;
  ageShort: (age: number) => string;
  firstName: string;
  lastName: string;
  country: string;
  expiryDate: string;
  yearsOld: string;
  hasVisa: string;
  yes: string;
  no: string;
  visaHeader: string;
  name: string;
  dragToMove: string;
  guestsHeader: (adults: number, children: number) => string;
}

const COPY: CopyMap<CopyShape> = {
  en: {
    saving: "Saving…",
    saved: "Saved",
    copy: "copy",
    copied: "copied",
    save: "save",
    cancel: "cancel",
    editGuest: "Edit guest",
    deleteGuest: "Delete guest",
    confirmDelete: "Delete this guest? This cannot be undone.",
    ageShort: (age) => `${age}y`,
    firstName: "First name",
    lastName: "Last name",
    country: "Country",
    expiryDate: "Expiry date",
    yearsOld: "Years old",
    hasVisa: "Has visa",
    yes: "Yes",
    no: "No",
    visaHeader: "Visa",
    name: "Name",
    dragToMove: "drag to move",
    guestsHeader: (a, ch) =>
      `Guests (${a} adult${a !== 1 ? "s" : ""}${ch > 0 ? `, ${ch} child${ch !== 1 ? "ren" : ""}` : ""})`,
  },
  ru: {
    saving: "Сохранение…",
    saved: "Сохранено",
    copy: "копировать",
    copied: "скопировано",
    save: "сохранить",
    cancel: "отмена",
    editGuest: "Редактировать гостя",
    deleteGuest: "Удалить гостя",
    confirmDelete: "Удалить этого гостя? Это действие необратимо.",
    ageShort: (age) => `${age} ${ruPlural(age, "год", "года", "лет")}`,
    firstName: "Имя",
    lastName: "Фамилия",
    country: "Страна",
    expiryDate: "Срок действия",
    yearsOld: "Возраст",
    hasVisa: "Есть виза",
    yes: "Да",
    no: "Нет",
    visaHeader: "Виза",
    name: "Имя",
    dragToMove: "перетащите, чтобы переместить",
    guestsHeader: (a, ch) =>
      `Гости (${a} ${ruPlural(a, "взрослый", "взрослых", "взрослых")}${ch > 0 ? `, ${ch} ${ruPlural(ch, "ребёнок", "ребёнка", "детей")}` : ""})`,
  },
  de: {
    saving: "Wird gespeichert…",
    saved: "Gespeichert",
    copy: "kopieren",
    copied: "kopiert",
    save: "speichern",
    cancel: "abbrechen",
    editGuest: "Gast bearbeiten",
    deleteGuest: "Gast löschen",
    confirmDelete: "Diesen Gast löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    ageShort: (age) => `${age} J.`,
    firstName: "Vorname",
    lastName: "Nachname",
    country: "Land",
    expiryDate: "Ablaufdatum",
    yearsOld: "Alter",
    hasVisa: "Visum vorhanden",
    yes: "Ja",
    no: "Nein",
    visaHeader: "Visum",
    name: "Name",
    dragToMove: "zum Verschieben ziehen",
    guestsHeader: (a, ch) =>
      `Gäste (${a} ${a === 1 ? "Erwachsener" : "Erwachsene"}${ch > 0 ? `, ${ch} ${ch === 1 ? "Kind" : "Kinder"}` : ""})`,
  },
  fr: {
    saving: "Enregistrement…",
    saved: "Enregistré",
    copy: "copier",
    copied: "copié",
    save: "enregistrer",
    cancel: "annuler",
    editGuest: "Modifier le voyageur",
    deleteGuest: "Supprimer le voyageur",
    confirmDelete: "Supprimer ce voyageur ? Action irréversible.",
    ageShort: (age) => `${age} ans`,
    firstName: "Prénom",
    lastName: "Nom",
    country: "Pays",
    expiryDate: "Date d’expiration",
    yearsOld: "Âge",
    hasVisa: "Visa",
    yes: "Oui",
    no: "Non",
    visaHeader: "Visa",
    name: "Nom",
    dragToMove: "glisser pour déplacer",
    guestsHeader: (a, ch) =>
      `Voyageurs (${a} ${a === 1 ? "adulte" : "adultes"}${ch > 0 ? `, ${ch} ${ch === 1 ? "enfant" : "enfants"}` : ""})`,
  },
  es: {
    saving: "Guardando…",
    saved: "Guardado",
    copy: "copiar",
    copied: "copiado",
    save: "guardar",
    cancel: "cancelar",
    editGuest: "Editar huésped",
    deleteGuest: "Eliminar huésped",
    confirmDelete: "¿Eliminar este huésped? La acción no se puede deshacer.",
    ageShort: (age) => `${age} a`,
    firstName: "Nombre",
    lastName: "Apellidos",
    country: "País",
    expiryDate: "Fecha de caducidad",
    yearsOld: "Edad",
    hasVisa: "Tiene visado",
    yes: "Sí",
    no: "No",
    visaHeader: "Visado",
    name: "Nombre",
    dragToMove: "arrastre para mover",
    guestsHeader: (a, ch) =>
      `Huéspedes (${a} ${a === 1 ? "adulto" : "adultos"}${ch > 0 ? `, ${ch} ${ch === 1 ? "niño" : "niños"}` : ""})`,
  },
  hr: {
    saving: "Spremanje…",
    saved: "Spremljeno",
    copy: "kopiraj",
    copied: "kopirano",
    save: "spremi",
    cancel: "odustani",
    editGuest: "Uredi gosta",
    deleteGuest: "Obriši gosta",
    confirmDelete: "Obrisati ovog gosta? To se ne može poništiti.",
    ageShort: (age) => `${age} ${hrPlural(age, "godina", "godine", "godina")}`,
    firstName: "Ime",
    lastName: "Prezime",
    country: "Država",
    expiryDate: "Datum isteka",
    yearsOld: "Dob (godine)",
    hasVisa: "Ima vizu",
    yes: "Da",
    no: "Ne",
    visaHeader: "Viza",
    name: "Ime",
    dragToMove: "povucite za premještanje",
    guestsHeader: (a, ch) =>
      `Gosti (${a} ${hrPlural(a, "odrasla osoba", "odrasle osobe", "odraslih osoba")}${ch > 0 ? `, ${ch} ${hrPlural(ch, "dijete", "djece", "djece")}` : ""})`,
  },
};

// Age computed dynamically from DOB so it doesn't go stale across years.
// Supports DD/MM/YYYY (extraction format) and YYYY-MM-DD.
function calculateAge(dob: string): number | null {
  if (!dob) return null;
  let year: number, month: number, day: number;
  const ddmm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dob);
  if (ddmm) {
    day = parseInt(ddmm[1]);
    month = parseInt(ddmm[2]);
    year = parseInt(ddmm[3]);
  } else {
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dob);
    if (!iso) return null;
    year = parseInt(iso[1]);
    month = parseInt(iso[2]);
    day = parseInt(iso[3]);
  }
  if (!year || !month || !day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (m < month || (m === month && d < day)) age--;
  if (age < 0 || age > 150) return null;
  return age;
}

function effectiveAge(guest: Guest): number {
  return calculateAge(guest.dateOfBirth) ?? guest.yearsOld;
}

interface GuestCardsProps {
  guests: Guest[];
  checkIn: string;
  checkOut: string;
  // RT-25.13 — used to build the WhatsApp prefill ("…this is {property},
  // your check-in is on {checkIn}…"). Optional because some legacy callers
  // don't have it in scope; falls back to a generic prefill in that case.
  propertyName?: string;
  onDeleteGuest: (id: number) => void;
  onUpdateParent: (childId: number, parentId: number | null) => void;
  onUpdateGuest: (id: number, fields: Partial<Guest>) => Promise<void>;
}

// Global last-copied tracking so highlight persists when switching tabs
let globalLastCopiedKey: string | null = null;
const copyListeners = new Set<() => void>();

function notifyCopyListeners(key: string) {
  globalLastCopiedKey = key;
  copyListeners.forEach((fn) => fn());
}

function CopyField({
  label,
  value,
  fieldKey,
}: {
  label: string;
  value: string;
  fieldKey: string;
}) {
  const { locale } = useI18n();
  const t = resolveCopy(COPY, locale);
  const [justCopied, setJustCopied] = useState(false);
  const [highlighted, setHighlighted] = useState(false);

  // Subscribe to global copy events
  useState(() => {
    const fn = () => setHighlighted(globalLastCopiedKey === fieldKey);
    copyListeners.add(fn);
    return () => { copyListeners.delete(fn); };
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    notifyCopyListeners(fieldKey);
    setHighlighted(true);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1200);
  };

  return (
    <div
      onClick={handleCopy}
      className={`group/field flex cursor-pointer items-center justify-between rounded-md px-2 py-1 transition-all ${
        highlighted
          ? "bg-[var(--ink)]/10 ring-1 ring-[var(--ink)]/20"
          : "hover:bg-white/5"
      }`}
    >
      <span className={`text-xs ${highlighted ? "text-[var(--ink)]/80" : "text-muted-foreground/60"}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-medium ${highlighted ? "text-[var(--ink)]" : ""}`}>{value || "—"}</span>
        <span className={`text-[11px] transition-all ${
          justCopied ? "text-emerald-500" : highlighted ? "text-[var(--ink)]/40" : "text-muted-foreground/0 group-hover/field:text-muted-foreground/30"
        }`}>
          {justCopied ? t.copied : t.copy}
        </span>
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1">
      <span className="text-xs text-muted-foreground/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-2/3 rounded border border-border/40 bg-background/50 px-2 py-0.5 text-sm font-medium text-[var(--ink)] focus:border-primary/60 focus:outline-none"
      />
    </div>
  );
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1">
      <span className="text-xs text-muted-foreground/60">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-2/3 rounded border border-border/40 bg-background/50 px-2 py-0.5 text-sm font-medium text-[var(--ink)] focus:border-primary/60 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function GuestCard({
  guest,
  childGuests,
  stayDays,
  checkIn,
  propertyName,
  onDelete,
  onDrop,
  onDragStart,
  onUpdateGuest,
}: {
  guest: Guest;
  childGuests: Guest[];
  stayDays: number;
  checkIn: string;
  propertyName: string;
  onDelete: (id: number) => void;
  onDrop: (childId: number, parentId: number) => void;
  onDragStart: (e: React.DragEvent, childId: number) => void;
  onUpdateGuest: (id: number, fields: Partial<Guest>) => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const t = resolveCopy(COPY, locale);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Guest>(guest);
  // RT-25.12 — per-guest notes auto-save. Local draft mirrors the
  // saved value so concurrent passport-extraction PATCHes don't wipe
  // an in-flight typing session; we only push to the server on blur
  // and only when the value actually changed.
  const [notesDraft, setNotesDraft] = useState<string>(guest.notes ?? "");
  const [notesSavedValue, setNotesSavedValue] = useState<string>(guest.notes ?? "");
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    // External update of guest.notes (e.g. parent refetch) — only
    // resync when the user isn't mid-edit. The check tolerates the
    // case where notesDraft was edited since the last save: keep the
    // user's draft and let blur reconcile.
    if (notesDraft === notesSavedValue) {
      setNotesDraft(guest.notes ?? "");
      setNotesSavedValue(guest.notes ?? "");
    } else {
      setNotesSavedValue(guest.notes ?? "");
    }
  }, [guest.notes]);  // eslint-disable-line react-hooks/exhaustive-deps

  // RT-25.13 — phone auto-save. Same draft/saved/state pattern as notes
  // so a concurrent passport-extraction PATCH can't wipe an in-flight
  // typing session. Validation errors from the API surface inline rather
  // than alerting; the saved value reverts to whatever the server holds.
  const [phoneDraft, setPhoneDraft] = useState<string>(guest.phone ?? "");
  const [phoneSavedValue, setPhoneSavedValue] = useState<string>(guest.phone ?? "");
  const [phoneState, setPhoneState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (phoneDraft === phoneSavedValue) {
      setPhoneDraft(guest.phone ?? "");
      setPhoneSavedValue(guest.phone ?? "");
    } else {
      setPhoneSavedValue(guest.phone ?? "");
    }
  }, [guest.phone]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const childId = parseInt(e.dataTransfer.getData("text/plain"));
      if (childId && childId !== guest.id) {
        onDrop(childId, guest.id);
      }
    },
    [guest.id, onDrop]
  );

  const startEdit = () => {
    setDraft(guest);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(guest);
    setEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const fields: Partial<Guest> = {
        fullName: draft.fullName,
        firstName: draft.firstName,
        lastName: draft.lastName,
        country: draft.country,
        citizenshipCode: draft.citizenshipCode,
        dateOfBirth: draft.dateOfBirth,
        gender: draft.gender,
        dateOfIssue: draft.dateOfIssue,
        expiryDate: draft.expiryDate,
        passportNumber: draft.passportNumber,
        issuedBy: draft.issuedBy,
        visaNumber: draft.visaNumber,
        visaFrom: draft.visaFrom,
        visaTo: draft.visaTo,
        hasVisa: draft.hasVisa,
        yearsOld: draft.yearsOld,
      };
      await onUpdateGuest(guest.id, fields);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof Guest>(key: K, value: Guest[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleNotesBlur = async () => {
    if (notesDraft === notesSavedValue) return;
    setNotesState("saving");
    try {
      await onUpdateGuest(guest.id, { notes: notesDraft });
      setNotesSavedValue(notesDraft);
      setNotesState("saved");
      setTimeout(() => setNotesState("idle"), 1600);
    } catch {
      setNotesState("idle");
    }
  };

  const handlePhoneBlur = async () => {
    if (phoneDraft === phoneSavedValue) return;
    setPhoneState("saving");
    try {
      await onUpdateGuest(guest.id, { phone: phoneDraft });
      // The server normalises the phone, so the next render via
      // guest.phone will reconcile our draft to the canonical form.
      setPhoneSavedValue(phoneDraft);
      setPhoneState("saved");
      setTimeout(() => setPhoneState((s) => (s === "saved" ? "idle" : s)), 1600);
    } catch {
      // 400 from the server (invalid format) — flag inline and let the
      // user edit. Don't clobber the draft so they can fix the typo.
      setPhoneState("error");
    }
  };

  // wa.me requires plain digits with no `+`; t.me/+phone requires the
  // leading `+` so the deeplink resolves. The saved phone is already
  // normalised, but we cover both shapes (user just typed but hasn't
  // blurred yet) for the disabled/enabled gating.
  const phoneForLinks = (phoneDraft || guest.phone || "").trim();
  const phoneEnabled =
    phoneForLinks.length > 0 && /^\+?\d{7,15}$/.test(phoneForLinks);
  const waDigits = phoneForLinks.replace(/^\+/, "");
  const tmePath = phoneForLinks.startsWith("+")
    ? phoneForLinks
    : `+${phoneForLinks}`;
  const checkInDate = (() => {
    if (!checkIn) return "";
    const d = new Date(checkIn);
    return isNaN(d.getTime()) ? checkIn : d.toISOString().split("T")[0];
  })();
  const guestFirstName = (guest.firstName || guest.fullName || "").trim();
  const messengerPrefill = tr("guest.messengerPrefill", {
    name: guestFirstName,
    property: propertyName || "",
    checkIn: checkInDate,
  });

  return (
    <div
      className={`rounded-xl border transition-all ${
        dragOver
          ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border/30 bg-card/30"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-[var(--ink)]">{guest.fullName}</span>
          <span className="shrink-0 text-xs text-[var(--ink-3)]">{t.ageShort(effectiveAge(guest))}</span>
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium text-emerald-500 transition-all hover:bg-emerald-500/15 disabled:opacity-40"
              >
                {saving ? t.saving : t.save}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground/60 transition-all hover:bg-white/5 hover:text-[var(--ink)] disabled:opacity-40"
              >
                {t.cancel}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="rounded-md p-1 text-muted-foreground/30 transition-all hover:bg-white/5 hover:text-[var(--ink)]"
                title={t.editGuest}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
              <button
                onClick={() => { if (confirm(t.confirmDelete)) onDelete(guest.id); }}
                title={t.deleteGuest}
                aria-label={t.deleteGuest}
                className="rounded-md p-1 text-muted-foreground/25 transition-all hover:bg-destructive/15 hover:text-destructive"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-border/15">
        {/* RT-25.13 — phone input + WhatsApp / Telegram quick-message buttons.
            Always visible (not gated by edit mode); auto-saves on blur via the
            same PATCH path used for passport edits. Server normalises the
            value, so the saved phone is canonical E.164-ish ("+...digits..."). */}
        <div className="p-1.5">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary/60">
              {tr("guest.phone")}
            </span>
            <span className={`text-[10px] transition-opacity ${phoneState === "idle" ? "opacity-0" : "opacity-100"} ${phoneState === "saved" ? "text-emerald-500" : phoneState === "error" ? "text-destructive" : "text-muted-foreground/60"}`}>
              {phoneState === "saving"
                ? t.saving
                : phoneState === "saved"
                ? t.saved
                : phoneState === "error"
                ? tr("guest.phoneInvalid")
                : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-2">
            <input
              type="tel"
              inputMode="tel"
              value={phoneDraft}
              onChange={(e) => {
                setPhoneDraft(e.target.value);
                if (phoneState === "saved" || phoneState === "error") setPhoneState("idle");
              }}
              onBlur={handlePhoneBlur}
              placeholder={tr("guest.phonePlaceholder")}
              className="min-w-0 flex-1 rounded-md border border-border/40 bg-background/50 px-2 py-1 text-sm text-[var(--ink)] placeholder-muted-foreground/30 focus:border-primary/60 focus:outline-none"
            />
            <a
              href={phoneEnabled ? `https://wa.me/${waDigits}?text=${encodeURIComponent(messengerPrefill)}` : undefined}
              target={phoneEnabled ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-disabled={!phoneEnabled}
              tabIndex={phoneEnabled ? 0 : -1}
              onClick={(e) => { if (!phoneEnabled) e.preventDefault(); }}
              title={tr("guest.messageOnWhatsApp")}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all ${
                phoneEnabled
                  ? "bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25"
                  : "bg-white/5 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M20.52 3.48A11.78 11.78 0 0012.05 0C5.5 0 .2 5.3.2 11.85c0 2.09.55 4.13 1.6 5.93L0 24l6.39-1.67a11.85 11.85 0 005.66 1.44h.01c6.55 0 11.85-5.3 11.85-11.85 0-3.16-1.23-6.13-3.39-8.44zM12.06 21.7h-.01a9.84 9.84 0 01-5.02-1.37l-.36-.21-3.79.99 1.01-3.69-.23-.38a9.83 9.83 0 01-1.5-5.19c0-5.44 4.42-9.86 9.87-9.86 2.63 0 5.11 1.03 6.97 2.89a9.79 9.79 0 012.89 6.97c-.01 5.45-4.43 9.85-9.83 9.85zm5.4-7.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.46a8.92 8.92 0 01-1.65-2.05c-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.91-2.18-.24-.58-.49-.5-.66-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.07 4.47.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.75-.71 2-1.4.25-.69.25-1.27.17-1.4-.07-.13-.27-.2-.57-.35z" />
              </svg>
            </a>
            <a
              href={phoneEnabled ? `https://t.me/${tmePath}` : undefined}
              target={phoneEnabled ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-disabled={!phoneEnabled}
              tabIndex={phoneEnabled ? 0 : -1}
              onClick={(e) => { if (!phoneEnabled) e.preventDefault(); }}
              title={tr("guest.messageOnTelegram")}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all ${
                phoneEnabled
                  ? "bg-[#229ED9]/15 text-[#229ED9] hover:bg-[#229ED9]/25"
                  : "bg-white/5 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M11.94.5C5.62.5.5 5.62.5 11.94s5.12 11.44 11.44 11.44 11.44-5.12 11.44-11.44S18.26.5 11.94.5zm5.31 7.86l-1.78 8.4c-.13.6-.49.74-.99.46l-2.74-2.02-1.32 1.27c-.15.15-.27.27-.55.27l.2-2.79 5.07-4.58c.22-.2-.05-.31-.34-.11l-6.27 3.95-2.7-.84c-.59-.18-.6-.59.12-.87l10.55-4.07c.49-.18.92.12.75.93z" />
              </svg>
            </a>
          </div>
          {phoneState === "idle" && phoneSavedValue === "" && (
            <p className="mt-1 px-2 text-[10px] text-muted-foreground/40">
              {tr("guest.phoneHelp")}
            </p>
          )}
        </div>
        {editing ? (
          <>
            <div className="p-1.5">
              <div className="mb-0.5 px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-primary/60">
                {tr("guest.identity")}
              </div>
              <EditField label={tr("guest.fullName")} value={draft.fullName} onChange={(v) => setField("fullName", v)} />
              <EditField label={t.firstName} value={draft.firstName} onChange={(v) => setField("firstName", v)} />
              <EditField label={t.lastName} value={draft.lastName} onChange={(v) => setField("lastName", v)} />
              <EditField label={t.country} value={draft.country} onChange={(v) => setField("country", v)} />
              <EditField label={tr("guest.citizenship")} value={draft.citizenshipCode} onChange={(v) => setField("citizenshipCode", v)} />
              <EditField label={tr("guest.dateOfBirth")} value={draft.dateOfBirth} onChange={(v) => setField("dateOfBirth", v)} />
              <EditField
                label={t.yearsOld}
                value={String(draft.yearsOld)}
                type="number"
                onChange={(v) => setField("yearsOld", parseInt(v) || 0)}
              />
              <EditSelect
                label={tr("guest.gender")}
                value={draft.gender}
                onChange={(v) => setField("gender", v)}
                options={[
                  { value: "", label: "—" },
                  { value: "M", label: tr("guest.male") },
                  { value: "F", label: tr("guest.female") },
                ]}
              />
            </div>
            <div className="p-1.5">
              <div className="mb-0.5 px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-primary/60">
                {tr("guest.document")}
              </div>
              <EditField label={tr("guest.passport")} value={draft.passportNumber} onChange={(v) => setField("passportNumber", v)} />
              <EditField label={tr("guest.issuedBy")} value={draft.issuedBy} onChange={(v) => setField("issuedBy", v)} />
              <EditField label={tr("guest.dateOfIssue")} value={draft.dateOfIssue} onChange={(v) => setField("dateOfIssue", v)} />
              <EditField label={t.expiryDate} value={draft.expiryDate} onChange={(v) => setField("expiryDate", v)} />
            </div>
            <div className="p-1.5">
              <div className="mb-0.5 px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-500/70">
                {t.visaHeader}
              </div>
              <EditSelect
                label={t.hasVisa}
                value={draft.hasVisa ? "yes" : "no"}
                onChange={(v) => setField("hasVisa", v === "yes")}
                options={[
                  { value: "no", label: t.no },
                  { value: "yes", label: t.yes },
                ]}
              />
              <EditField label={tr("guest.visaNumber")} value={draft.visaNumber} onChange={(v) => setField("visaNumber", v)} />
              <EditField label={tr("guest.visaFrom")} value={draft.visaFrom} onChange={(v) => setField("visaFrom", v)} />
              <EditField label={tr("guest.visaTo")} value={draft.visaTo} onChange={(v) => setField("visaTo", v)} />
            </div>
          </>
        ) : (
          <>
            {/* Block 1: Citizenship, DOB, Passport */}
            <div className="p-1.5">
              <div className="mb-0.5 px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-primary/60">
                {tr("guest.identity")}
              </div>
              <CopyField label={tr("guest.citizenship")} value={guest.citizenshipCode} fieldKey={`${guest.id}-ctz`} />
              <CopyField label={tr("guest.dateOfBirth")} value={guest.dateOfBirth} fieldKey={`${guest.id}-dob`} />
              <CopyField label={tr("guest.passport")} value={guest.passportNumber} fieldKey={`${guest.id}-pp`} />
            </div>

            {/* Block 2: Issue, Authority, Name, Gender, Stay */}
            <div className="p-1.5">
              <div className="mb-0.5 px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-primary/60">
                {tr("guest.document")}
              </div>
              <CopyField label={tr("guest.dateOfIssue")} value={guest.dateOfIssue} fieldKey={`${guest.id}-doi`} />
              <CopyField label={tr("guest.issuedBy")} value={guest.issuedBy} fieldKey={`${guest.id}-ib`} />
              <CopyField label={tr("guest.fullName")} value={`${guest.lastName} ${guest.firstName}`} fieldKey={`${guest.id}-fn`} />
              <CopyField label={tr("guest.gender")} value={guest.gender === "M" ? tr("guest.male") : guest.gender === "F" ? tr("guest.female") : guest.gender} fieldKey={`${guest.id}-gen`} />
              <CopyField label={tr("guest.arrivedOn")} value={String(stayDays)} fieldKey={`${guest.id}-stay`} />
            </div>

            {/* Block 3: Visit info + Visa (if uploaded) */}
            <div className="p-1.5">
              <div className="mb-0.5 px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-500/70">
                {guest.hasVisa ? tr("guest.visa") : tr("guest.visit")}
              </div>
              {guest.hasVisa && (
                <>
                  <CopyField label={tr("guest.visaNumber")} value={guest.visaNumber} fieldKey={`${guest.id}-vn`} />
                  <CopyField label={tr("guest.visaFrom")} value={guest.visaFrom} fieldKey={`${guest.id}-vf`} />
                  <CopyField label={tr("guest.visaTo")} value={guest.visaTo} fieldKey={`${guest.id}-vt`} />
                </>
              )}
              <CopyField label={tr("guest.visitType")} value={tr("guest.tourist")} fieldKey={`${guest.id}-vtype`} />
              <CopyField label={tr("guest.guestType")} value={tr("guest.other")} fieldKey={`${guest.id}-gtype`} />
            </div>

            {/* Block 4: Children (only if any attached) */}
            {childGuests.length > 0 && (
              <div className="p-1.5">
                <div className="mb-0.5 px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-amber-400/70">
                  {tr("guest.children")} ({childGuests.length})
                </div>
                {childGuests.map((child) => (
                  <div
                    key={child.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, child.id)}
                    className="group/child ml-1 cursor-grab rounded-lg border border-border/15 bg-white/[0.02] p-1.5 mb-1 active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-medium">{child.fullName}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground/30">{t.dragToMove}</span>
                        <svg className="h-3 w-3 text-muted-foreground/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                        </svg>
                      </div>
                    </div>
                    <CopyField label={t.name} value={child.fullName} fieldKey={`${child.id}-cfn`} />
                    <CopyField label={tr("guest.dateOfBirth")} value={child.dateOfBirth} fieldKey={`${child.id}-cdob`} />
                    <CopyField label={tr("guest.gender")} value={child.gender === "M" ? tr("guest.male") : child.gender === "F" ? tr("guest.female") : child.gender} fieldKey={`${child.id}-cgen`} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {/* RT-25.12 — per-guest notes. Always visible (not gated by
            edit mode); auto-saves on blur via the same PATCH path
            used for passport edits. Empty notes still render the
            section so the host has an obvious place to start typing. */}
        <div className="p-1.5">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary/60">
              {tr("guest.notes")}
            </span>
            <span className={`text-[10px] transition-opacity ${notesState === "idle" ? "opacity-0" : "opacity-100"} ${notesState === "saved" ? "text-emerald-500" : "text-muted-foreground/60"}`}>
              {notesState === "saving" ? t.saving : notesState === "saved" ? t.saved : ""}
            </span>
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => {
              setNotesDraft(e.target.value);
              if (notesState === "saved") setNotesState("idle");
            }}
            onBlur={handleNotesBlur}
            placeholder={tr("guest.notesPlaceholder")}
            className="block w-full whitespace-pre-wrap rounded-md border border-border/40 bg-background/50 px-2 py-1.5 text-sm text-[var(--ink)] placeholder-muted-foreground/30 focus:border-primary/60 focus:outline-none"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

export function GuestCards({
  guests,
  checkIn,
  checkOut,
  propertyName,
  onDeleteGuest,
  onUpdateParent,
  onUpdateGuest,
}: GuestCardsProps) {
  const { t: tr, locale } = useI18n();
  const t = resolveCopy(COPY, locale);
  const stayDays = (() => {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  })();

  // Separate adults (16+) and children (<16) using dynamically computed age
  const adults = guests.filter((g) => effectiveAge(g) >= 16 && g.parentId === null);
  const allChildren = guests.filter((g) => effectiveAge(g) < 16);

  // Auto-assign unlinked children to first adult
  const unlinkedChildren = allChildren.filter((c) => c.parentId === null);
  if (unlinkedChildren.length > 0 && adults.length > 0) {
    // Auto-link on first render
    for (const child of unlinkedChildren) {
      onUpdateParent(child.id, adults[0].id);
    }
  }

  const getChildrenFor = (parentId: number) =>
    allChildren.filter((c) => c.parentId === parentId);

  const handleDrop = (childId: number, parentId: number) => {
    onUpdateParent(childId, parentId);
  };

  const handleDragStart = (e: React.DragEvent, childId: number) => {
    e.dataTransfer.setData("text/plain", String(childId));
    e.dataTransfer.effectAllowed = "move";
  };

  if (guests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/25 py-12">
        <svg className="h-5 w-5 text-muted-foreground/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p className="text-xs text-muted-foreground/40">{tr("guest.noGuests")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
          {t.guestsHeader(adults.length, allChildren.length)}
        </h2>
        <span className="text-xs text-muted-foreground/30">{tr("guest.clickToCopy")}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adults.map((guest) => (
          <GuestCard
            key={guest.id}
            guest={guest}
            childGuests={getChildrenFor(guest.id)}
            stayDays={stayDays}
            checkIn={checkIn}
            propertyName={propertyName ?? ""}
            onDelete={onDeleteGuest}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onUpdateGuest={onUpdateGuest}
          />
        ))}
      </div>
    </div>
  );
}
