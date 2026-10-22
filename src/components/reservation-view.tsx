"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GuestCards } from "@/components/guest-cards";
import { useI18n } from "@/lib/i18n/context";
import { hrPlural, resolveCopy, type CopyMap } from "@/lib/i18n/translations";
import type { Guest, Reservation } from "@/lib/types";
import {
  reservationNights,
  toReservationDateInput,
  validateReservationDateRange,
} from "@/lib/reservation-dates";
import {
  normalizeCurrencyCode,
  parseGrossAmountText,
} from "@/lib/reservation-revenue";
import {
  DEFAULT_PROPERTY_TIME_ZONE,
  getOwnerCalendarWindow,
} from "@/lib/owner-calendar-window";

// Pre-arrival discovery hint — localized in every supported locale.
// The rest of the component's own copy lives in COPY below; shared
// labels (Save, Cancel, Copy…) come from the global translations.
interface HintCopy {
  title: string;
  before: string;
  link: string;
  after: string;
}

const HINT_COPY: CopyMap<HintCopy> = {
  en: {
    title: "Tip — pre-arrival form.",
    before:
      "You can set up a guest form (passport details, arrival time, questions) under",
    link: "the Pre-arrival form page",
    after:
      ". Once configured, a shareable link appears here for every reservation.",
  },
  ru: {
    title: "Совет — форма перед заездом.",
    before:
      "Вы можете настроить анкету для гостя (паспортные данные, время заезда, вопросы) в разделе",
    link: "странице «Форма перед заездом»",
    after:
      ". После настройки здесь для каждого бронирования появится ссылка, которой можно поделиться.",
  },
  de: {
    title: "Tipp — Anreiseformular.",
    before:
      "Sie können ein Gästeformular (Ausweisdaten, Ankunftszeit, Fragen) einrichten unter",
    link: "der Seite „Anreiseformular“",
    after:
      ". Nach der Einrichtung erscheint hier für jede Reservierung ein teilbarer Link.",
  },
  fr: {
    title: "Astuce — formulaire de pré-arrivée.",
    before:
      "Vous pouvez configurer un formulaire pour le voyageur (données du passeport, heure d’arrivée, questions) dans",
    link: "la page Formulaire de pré-arrivée",
    after:
      ". Une fois configuré, un lien partageable apparaît ici pour chaque réservation.",
  },
  es: {
    title: "Consejo — formulario previo a la llegada.",
    before:
      "Puede configurar un formulario para el huésped (datos del pasaporte, hora de llegada, preguntas) en",
    link: "la página Formulario previo a la llegada",
    after:
      ". Una vez configurado, aquí aparecerá un enlace para compartir en cada reserva.",
  },
  hr: {
    title: "Savjet — obrazac prije dolaska.",
    before:
      "Obrazac za goste (podaci iz putovnice, vrijeme dolaska, pitanja) postavljate na",
    link: "stranici obrasca prije dolaska",
    after:
      ". Nakon postavljanja ovdje se za svaku rezervaciju pojavi link za dijeljenje.",
  },
};

/** Russian picks the noun form by the same 1 / 2-4 / 5+ ends-in-digit
 *  rule (teens excepted) as Croatian, so the helper fits both. */
const ruPlural = hrPlural;

interface ReservationCopy {
  dateLocale: string;
  direct: string;
  statusRevoked: string;
  statusEvisitorConfirmed: string;
  statusEvisitorReady: string;
  statusOwnerApproved: string;
  statusOwnerReview: string;
  statusGuestComplete: string;
  statusGuestStarted: string;
  statusAwaitingGuest: string;
  submittedAgo: (days: number) => string;
  linkGeneratedAgo: (days: number) => string;
  noAnswer: string;
  yes: string;
  no: string;
  deleteConfirm: (name: string) => string;
  deleteReservation: string;
  grossAmountInvalid: string;
  storedGrossAmount: string;
  unknown: string;
  currency: string;
  grossAmountHint: string;
  stayLength: (nights: number, days: number) => string;
  guestsCount: (n: number) => string;
  preArrivalForm: string;
  shareHint: string;
  confirmedTravelers: string;
  saved: string;
  enterRange: string;
  requiredBeforeLink: string;
  generating: string;
  linkCopied: string;
  tryAgain: string;
  copyLinkAgain: string;
  copyFormLink: string;
  startOwnerReview: string;
  approveCheckedData: string;
  prepareHandoff: string;
  opening: string;
  openHandoff: string;
  confirmManualEntry: string;
  revokeLink: string;
  messenger: string;
  messengerHint: string;
  copyGroupName: string;
  saveName: string;
  resetToAuto: string;
  openTelegramGroup: string;
  openWhatsAppGroup: string;
  editLinks: string;
  addGroupLinks: string;
  blankRemovesLink: string;
  privacyNote: string;
  noPassportData: string;
  networkError: string;
  extractedAll: (ok: number, total: number) => string;
  extractedPartial: (ok: number, total: number, failed: number) => string;
  dismissSummary: string;
  generateMessageTitle: string;
  generateMessage: string;
  exportCsvTitle: string;
  exportCsv: string;
  closePreview: string;
  preArrivalAnswers: string;
  registrationReview: string;
  travelersCount: (n: number) => string;
  lead: string;
  born: string;
  gender: string;
  birthPlace: string;
  citizenship: string;
  residence: string;
  document: string;
  taxSuggestion: string;
  reviewRequired: string;
  manualReviewRequired: string;
  borderEntry: string;
  maskedNote: string;
  lastChanged: (date: string) => string;
  handoffTitle: string;
  handoffDesc: string;
  close: string;
  stay: string;
  arrival: string;
  guests: string;
}

const COPY: CopyMap<ReservationCopy> = {
  en: {
    dateLocale: "en-GB",
    direct: "Direct",
    statusRevoked: "Link revoked",
    statusEvisitorConfirmed: "Manual eVisitor entry confirmed",
    statusEvisitorReady: "Ready for manual eVisitor entry",
    statusOwnerApproved: "Guest data checked and approved",
    statusOwnerReview: "Owner review in progress",
    statusGuestComplete: "Guest complete — owner review not started",
    statusGuestStarted: "Guest started — data incomplete",
    statusAwaitingGuest: "Awaiting guest completion",
    submittedAgo: (d) =>
      d === 0 ? "Submitted today" : `Submitted ${d} day${d === 1 ? "" : "s"} ago`,
    linkGeneratedAgo: (d) =>
      d === 0
        ? "Link generated today, awaiting reply"
        : `Link generated ${d} day${d === 1 ? "" : "s"} ago, awaiting reply`,
    noAnswer: "No answer",
    yes: "Yes",
    no: "No",
    deleteConfirm: (name) =>
      `Delete reservation "${name}"? This removes the reservation and any guests / passport docs attached to it. If it was claimed from a synced booking, that synced event is removed too.`,
    deleteReservation: "Delete reservation",
    grossAmountInvalid:
      "Enter a non-negative gross amount with at most two decimals and a valid ISO currency.",
    storedGrossAmount: "Stored gross amount",
    unknown: "Unknown",
    currency: "Currency",
    grossAmountHint:
      "Optional owner-entered amount. Leave blank when unknown; no price is inferred.",
    stayLength: (n, d) =>
      `${n} ${n === 1 ? "night" : "nights"} · ${d} ${d === 1 ? "day" : "days"}`,
    guestsCount: (n) => `${n} guest${n !== 1 ? "s" : ""}`,
    preArrivalForm: "Pre-arrival form",
    shareHint: "Copy the link, then share it with your guest via WhatsApp, SMS, or email.",
    confirmedTravelers: "Confirmed travelers",
    saved: "Saved",
    enterRange: "Enter 1–50",
    requiredBeforeLink: "Required before link generation",
    generating: "Generating…",
    linkCopied: "Link copied",
    tryAgain: "Try again",
    copyLinkAgain: "Copy link again",
    copyFormLink: "Copy form link",
    startOwnerReview: "Start owner review",
    approveCheckedData: "Approve checked data",
    prepareHandoff: "Prepare manual eVisitor handoff",
    opening: "Opening…",
    openHandoff: "Open manual handoff",
    confirmManualEntry: "Confirm manually entered",
    revokeLink: "Revoke link",
    messenger: "Messenger",
    messengerHint:
      "Save the guest’s phone for a personal chat, or paste a group’s link to jump back in one click.",
    copyGroupName: "Copy group name",
    saveName: "Save name",
    resetToAuto: "Reset to auto",
    openTelegramGroup: "Open Telegram group",
    openWhatsAppGroup: "Open WhatsApp group",
    editLinks: "Edit links",
    addGroupLinks: "Add group links",
    blankRemovesLink: "Leave a field blank to remove the saved link.",
    privacyNote:
      "Passport documents are private to your account. RentTools support and administrators cannot view the passport details you upload here.",
    noPassportData: "No passport data found",
    networkError: "Network error",
    extractedAll: (ok, total) => `Extracted ${ok}/${total} passports successfully`,
    extractedPartial: (ok, total, failed) => `${ok}/${total} extracted, ${failed} failed`,
    dismissSummary: "Dismiss extraction summary",
    generateMessageTitle: "Generate a message from a saved template",
    generateMessage: "Generate message",
    exportCsvTitle: "Export all guest data to CSV",
    exportCsv: "Export CSV",
    closePreview: "Close template preview",
    preArrivalAnswers: "Pre-arrival answers",
    registrationReview: "Guest registration review",
    travelersCount: (n) => `${n} traveler${n === 1 ? "" : "s"}`,
    lead: "lead",
    born: "Born",
    gender: "Gender",
    birthPlace: "Birth place",
    citizenship: "Citizenship",
    residence: "Residence",
    document: "Document",
    taxSuggestion: "Tax suggestion",
    reviewRequired: "Review required",
    manualReviewRequired: "Manual review required",
    borderEntry: "Border entry",
    maskedNote:
      "Document numbers remain masked in this review. Full numbers are loaded only from the protected manual handoff. No action here submits anything to eVisitor.",
    lastChanged: (date) => ` Last changed ${date}.`,
    handoffTitle: "Manual eVisitor handoff",
    handoffDesc:
      "Protected no-store view. Copy these values manually; RentTools does not contact eVisitor.",
    close: "Close",
    stay: "Stay",
    arrival: "Arrival",
    guests: "Guests",
  },
  ru: {
    dateLocale: "ru-RU",
    direct: "Напрямую",
    statusRevoked: "Ссылка отозвана",
    statusEvisitorConfirmed: "Ручной ввод в eVisitor подтверждён",
    statusEvisitorReady: "Готово к ручному вводу в eVisitor",
    statusOwnerApproved: "Данные гостей проверены и одобрены",
    statusOwnerReview: "Идёт проверка владельцем",
    statusGuestComplete: "Гость заполнил форму — проверка владельцем не начата",
    statusGuestStarted: "Гость начал заполнение — данные неполные",
    statusAwaitingGuest: "Ожидается заполнение гостем",
    submittedAgo: (d) =>
      d === 0
        ? "Отправлено сегодня"
        : `Отправлено ${d} ${ruPlural(d, "день", "дня", "дней")} назад`,
    linkGeneratedAgo: (d) =>
      d === 0
        ? "Ссылка создана сегодня, ожидается ответ"
        : `Ссылка создана ${d} ${ruPlural(d, "день", "дня", "дней")} назад, ожидается ответ`,
    noAnswer: "Нет ответа",
    yes: "Да",
    no: "Нет",
    deleteConfirm: (name) =>
      `Удалить бронирование «${name}»? Будут удалены бронирование и все прикреплённые к нему гости и паспортные документы. Если оно было взято из синхронизированной брони, это синхронизированное событие тоже будет удалено.`,
    deleteReservation: "Удалить бронирование",
    grossAmountInvalid:
      "Введите неотрицательную сумму брутто (не более двух знаков после запятой) и корректный код валюты ISO.",
    storedGrossAmount: "Сохранённая сумма брутто",
    unknown: "Неизвестно",
    currency: "Валюта",
    grossAmountHint:
      "Необязательная сумма, которую вводит владелец. Оставьте поле пустым, если сумма неизвестна; цена не вычисляется автоматически.",
    stayLength: (n, d) =>
      `${n} ${ruPlural(n, "ночь", "ночи", "ночей")} · ${d} ${ruPlural(d, "день", "дня", "дней")}`,
    guestsCount: (n) => `${n} ${ruPlural(n, "гость", "гостя", "гостей")}`,
    preArrivalForm: "Форма перед заездом",
    shareHint: "Скопируйте ссылку и отправьте её гостю через WhatsApp, SMS или email.",
    confirmedTravelers: "Подтверждённое число гостей",
    saved: "Сохранено",
    enterRange: "Введите 1–50",
    requiredBeforeLink: "Нужно указать до создания ссылки",
    generating: "Создание…",
    linkCopied: "Ссылка скопирована",
    tryAgain: "Повторить",
    copyLinkAgain: "Скопировать ссылку ещё раз",
    copyFormLink: "Скопировать ссылку на форму",
    startOwnerReview: "Начать проверку",
    approveCheckedData: "Одобрить проверенные данные",
    prepareHandoff: "Подготовить данные для ручного ввода в eVisitor",
    opening: "Открытие…",
    openHandoff: "Открыть данные для ручного ввода",
    confirmManualEntry: "Подтвердить ручной ввод",
    revokeLink: "Отозвать ссылку",
    messenger: "Мессенджер",
    messengerHint:
      "Сохраните телефон гостя для личного чата или вставьте ссылку на группу, чтобы возвращаться в неё одним нажатием.",
    copyGroupName: "Скопировать название группы",
    saveName: "Сохранить название",
    resetToAuto: "Вернуть автоназвание",
    openTelegramGroup: "Открыть группу в Telegram",
    openWhatsAppGroup: "Открыть группу в WhatsApp",
    editLinks: "Изменить ссылки",
    addGroupLinks: "Добавить ссылки на группы",
    blankRemovesLink: "Оставьте поле пустым, чтобы удалить сохранённую ссылку.",
    privacyNote:
      "Паспортные документы доступны только вашему аккаунту. Поддержка и администраторы RentTools не могут просматривать загруженные здесь паспортные данные.",
    noPassportData: "Паспортные данные не найдены",
    networkError: "Ошибка сети",
    extractedAll: (ok, total) => `Успешно извлечено паспортов: ${ok}/${total}`,
    extractedPartial: (ok, total, failed) => `Извлечено ${ok}/${total}, с ошибкой: ${failed}`,
    dismissSummary: "Скрыть итоги извлечения",
    generateMessageTitle: "Создать сообщение из сохранённого шаблона",
    generateMessage: "Создать сообщение",
    exportCsvTitle: "Экспортировать все данные гостей в CSV",
    exportCsv: "Экспорт CSV",
    closePreview: "Закрыть предпросмотр шаблона",
    preArrivalAnswers: "Ответы перед заездом",
    registrationReview: "Проверка регистрации гостей",
    travelersCount: (n) => `${n} ${ruPlural(n, "гость", "гостя", "гостей")}`,
    lead: "основной гость",
    born: "Дата рождения",
    gender: "Пол",
    birthPlace: "Место рождения",
    citizenship: "Гражданство",
    residence: "Место жительства",
    document: "Документ",
    taxSuggestion: "Предлагаемая категория сбора",
    reviewRequired: "Требуется проверка",
    manualReviewRequired: "Требуется ручная проверка",
    borderEntry: "Въезд в страну",
    maskedNote:
      "Номера документов в этой проверке скрыты. Полные номера загружаются только в защищённом окне для ручного ввода. Отсюда ничего не отправляется в eVisitor.",
    lastChanged: (date) => ` Последнее изменение: ${date}.`,
    handoffTitle: "Данные для ручного ввода в eVisitor",
    handoffDesc:
      "Защищённый просмотр без кэширования. Перенесите эти значения вручную; RentTools не связывается с eVisitor.",
    close: "Закрыть",
    stay: "Проживание",
    arrival: "Прибытие",
    guests: "Гости",
  },
  de: {
    dateLocale: "de-DE",
    direct: "Direkt",
    statusRevoked: "Link widerrufen",
    statusEvisitorConfirmed: "Manuelle eVisitor-Eingabe bestätigt",
    statusEvisitorReady: "Bereit für die manuelle eVisitor-Eingabe",
    statusOwnerApproved: "Gästedaten geprüft und freigegeben",
    statusOwnerReview: "Prüfung durch den Eigentümer läuft",
    statusGuestComplete: "Gast fertig — Prüfung durch den Eigentümer noch nicht begonnen",
    statusGuestStarted: "Gast hat begonnen — Daten unvollständig",
    statusAwaitingGuest: "Warten auf die Angaben des Gastes",
    submittedAgo: (d) =>
      d === 0 ? "Heute übermittelt" : `Vor ${d} ${d === 1 ? "Tag" : "Tagen"} übermittelt`,
    linkGeneratedAgo: (d) =>
      d === 0
        ? "Link heute erstellt, Antwort ausstehend"
        : `Link vor ${d} ${d === 1 ? "Tag" : "Tagen"} erstellt, Antwort ausstehend`,
    noAnswer: "Keine Antwort",
    yes: "Ja",
    no: "Nein",
    deleteConfirm: (name) =>
      `Reservierung „${name}“ löschen? Damit werden die Reservierung und alle zugehörigen Gäste und Passdokumente entfernt. Wurde sie aus einer synchronisierten Buchung übernommen, wird auch dieses synchronisierte Ereignis entfernt.`,
    deleteReservation: "Reservierung löschen",
    grossAmountInvalid:
      "Geben Sie einen nicht negativen Bruttobetrag mit höchstens zwei Nachkommastellen und eine gültige ISO-Währung ein.",
    storedGrossAmount: "Gespeicherter Bruttobetrag",
    unknown: "Unbekannt",
    currency: "Währung",
    grossAmountHint:
      "Optionaler, vom Eigentümer eingegebener Betrag. Lassen Sie das Feld leer, wenn er unbekannt ist; es wird kein Preis abgeleitet.",
    stayLength: (n, d) =>
      `${n} ${n === 1 ? "Nacht" : "Nächte"} · ${d} ${d === 1 ? "Tag" : "Tage"}`,
    guestsCount: (n) => `${n} ${n === 1 ? "Gast" : "Gäste"}`,
    preArrivalForm: "Anreiseformular",
    shareHint:
      "Kopieren Sie den Link und teilen Sie ihn per WhatsApp, SMS oder E-Mail mit Ihrem Gast.",
    confirmedTravelers: "Bestätigte Reisende",
    saved: "Gespeichert",
    enterRange: "1–50 eingeben",
    requiredBeforeLink: "Vor dem Erstellen des Links erforderlich",
    generating: "Wird erstellt…",
    linkCopied: "Link kopiert",
    tryAgain: "Erneut versuchen",
    copyLinkAgain: "Link erneut kopieren",
    copyFormLink: "Formular-Link kopieren",
    startOwnerReview: "Prüfung starten",
    approveCheckedData: "Geprüfte Daten freigeben",
    prepareHandoff: "Manuelle eVisitor-Übergabe vorbereiten",
    opening: "Wird geöffnet…",
    openHandoff: "Manuelle Übergabe öffnen",
    confirmManualEntry: "Manuelle Eingabe bestätigen",
    revokeLink: "Link widerrufen",
    messenger: "Messenger",
    messengerHint:
      "Speichern Sie die Telefonnummer des Gastes für einen persönlichen Chat, oder fügen Sie den Link einer Gruppe ein, um mit einem Klick zurückzukehren.",
    copyGroupName: "Gruppennamen kopieren",
    saveName: "Namen speichern",
    resetToAuto: "Automatischen Namen wiederherstellen",
    openTelegramGroup: "Telegram-Gruppe öffnen",
    openWhatsAppGroup: "WhatsApp-Gruppe öffnen",
    editLinks: "Links bearbeiten",
    addGroupLinks: "Gruppen-Links hinzufügen",
    blankRemovesLink: "Lassen Sie ein Feld leer, um den gespeicherten Link zu entfernen.",
    privacyNote:
      "Passdokumente sind nur für Ihr Konto sichtbar. Support und Administratoren von RentTools können die hier hochgeladenen Passdaten nicht einsehen.",
    noPassportData: "Keine Passdaten gefunden",
    networkError: "Netzwerkfehler",
    extractedAll: (ok, total) => `${ok}/${total} Pässe erfolgreich ausgelesen`,
    extractedPartial: (ok, total, failed) =>
      `${ok}/${total} ausgelesen, ${failed} fehlgeschlagen`,
    dismissSummary: "Zusammenfassung schließen",
    generateMessageTitle: "Nachricht aus einer gespeicherten Vorlage erstellen",
    generateMessage: "Nachricht erstellen",
    exportCsvTitle: "Alle Gästedaten als CSV exportieren",
    exportCsv: "CSV exportieren",
    closePreview: "Vorlagenvorschau schließen",
    preArrivalAnswers: "Antworten vor der Anreise",
    registrationReview: "Prüfung der Gästeanmeldung",
    travelersCount: (n) => `${n} ${n === 1 ? "Reisender" : "Reisende"}`,
    lead: "Hauptgast",
    born: "Geboren",
    gender: "Geschlecht",
    birthPlace: "Geburtsort",
    citizenship: "Staatsangehörigkeit",
    residence: "Wohnsitz",
    document: "Dokument",
    taxSuggestion: "Vorgeschlagene Abgabenkategorie",
    reviewRequired: "Prüfung erforderlich",
    manualReviewRequired: "Manuelle Prüfung erforderlich",
    borderEntry: "Einreise",
    maskedNote:
      "Dokumentnummern bleiben in dieser Prüfung maskiert. Vollständige Nummern werden nur in der geschützten manuellen Übergabe geladen. Von hier aus wird nichts an eVisitor übermittelt.",
    lastChanged: (date) => ` Zuletzt geändert: ${date}.`,
    handoffTitle: "Manuelle eVisitor-Übergabe",
    handoffDesc:
      "Geschützte Ansicht ohne Zwischenspeicherung. Übertragen Sie diese Werte manuell; RentTools kontaktiert eVisitor nicht.",
    close: "Schließen",
    stay: "Aufenthalt",
    arrival: "Ankunft",
    guests: "Gäste",
  },
  fr: {
    dateLocale: "fr-FR",
    direct: "Direct",
    statusRevoked: "Lien révoqué",
    statusEvisitorConfirmed: "Saisie manuelle dans eVisitor confirmée",
    statusEvisitorReady: "Prêt pour la saisie manuelle dans eVisitor",
    statusOwnerApproved: "Données des voyageurs vérifiées et approuvées",
    statusOwnerReview: "Vérification par le propriétaire en cours",
    statusGuestComplete: "Rempli par le voyageur — vérification par le propriétaire non commencée",
    statusGuestStarted: "Commencé par le voyageur — données incomplètes",
    statusAwaitingGuest: "En attente du voyageur",
    submittedAgo: (d) =>
      d === 0 ? "Envoyé aujourd’hui" : `Envoyé il y a ${d} ${d === 1 ? "jour" : "jours"}`,
    linkGeneratedAgo: (d) =>
      d === 0
        ? "Lien créé aujourd’hui, en attente de réponse"
        : `Lien créé il y a ${d} ${d === 1 ? "jour" : "jours"}, en attente de réponse`,
    noAnswer: "Pas de réponse",
    yes: "Oui",
    no: "Non",
    deleteConfirm: (name) =>
      `Supprimer la réservation « ${name} » ? Cela supprime la réservation ainsi que les voyageurs et documents de passeport associés. Si elle provient d’une réservation synchronisée, cet événement synchronisé est également supprimé.`,
    deleteReservation: "Supprimer la réservation",
    grossAmountInvalid:
      "Saisissez un montant brut positif ou nul, avec au plus deux décimales, et une devise ISO valide.",
    storedGrossAmount: "Montant brut enregistré",
    unknown: "Inconnu",
    currency: "Devise",
    grossAmountHint:
      "Montant facultatif saisi par le propriétaire. Laissez vide s’il est inconnu ; aucun prix n’est déduit.",
    stayLength: (n, d) =>
      `${n} ${n === 1 ? "nuit" : "nuits"} · ${d} ${d === 1 ? "jour" : "jours"}`,
    guestsCount: (n) => `${n} ${n === 1 ? "voyageur" : "voyageurs"}`,
    preArrivalForm: "Formulaire de pré-arrivée",
    shareHint: "Copiez le lien, puis partagez-le avec votre voyageur par WhatsApp, SMS ou e-mail.",
    confirmedTravelers: "Voyageurs confirmés",
    saved: "Enregistré",
    enterRange: "Saisissez 1–50",
    requiredBeforeLink: "Requis avant de créer le lien",
    generating: "Création…",
    linkCopied: "Lien copié",
    tryAgain: "Réessayer",
    copyLinkAgain: "Copier à nouveau le lien",
    copyFormLink: "Copier le lien du formulaire",
    startOwnerReview: "Commencer la vérification",
    approveCheckedData: "Approuver les données vérifiées",
    prepareHandoff: "Préparer la saisie manuelle dans eVisitor",
    opening: "Ouverture…",
    openHandoff: "Ouvrir les données de saisie manuelle",
    confirmManualEntry: "Confirmer la saisie manuelle",
    revokeLink: "Révoquer le lien",
    messenger: "Messagerie",
    messengerHint:
      "Enregistrez le téléphone du voyageur pour une discussion privée, ou collez le lien d’un groupe pour y revenir en un clic.",
    copyGroupName: "Copier le nom du groupe",
    saveName: "Enregistrer le nom",
    resetToAuto: "Rétablir le nom automatique",
    openTelegramGroup: "Ouvrir le groupe Telegram",
    openWhatsAppGroup: "Ouvrir le groupe WhatsApp",
    editLinks: "Modifier les liens",
    addGroupLinks: "Ajouter des liens de groupe",
    blankRemovesLink: "Laissez un champ vide pour supprimer le lien enregistré.",
    privacyNote:
      "Les documents de passeport sont réservés à votre compte. Le support et les administrateurs de RentTools ne peuvent pas voir les données de passeport que vous téléversez ici.",
    noPassportData: "Aucune donnée de passeport trouvée",
    networkError: "Erreur réseau",
    extractedAll: (ok, total) => `${ok}/${total} passeports extraits avec succès`,
    extractedPartial: (ok, total, failed) => `${ok}/${total} extraits, ${failed} en échec`,
    dismissSummary: "Fermer le résumé d’extraction",
    generateMessageTitle: "Générer un message à partir d’un modèle enregistré",
    generateMessage: "Générer un message",
    exportCsvTitle: "Exporter toutes les données des voyageurs en CSV",
    exportCsv: "Exporter en CSV",
    closePreview: "Fermer l’aperçu du modèle",
    preArrivalAnswers: "Réponses avant l’arrivée",
    registrationReview: "Vérification de l’enregistrement des voyageurs",
    travelersCount: (n) => `${n} ${n === 1 ? "voyageur" : "voyageurs"}`,
    lead: "principal",
    born: "Naissance",
    gender: "Sexe",
    birthPlace: "Lieu de naissance",
    citizenship: "Nationalité",
    residence: "Résidence",
    document: "Document",
    taxSuggestion: "Catégorie de taxe suggérée",
    reviewRequired: "Vérification requise",
    manualReviewRequired: "Vérification manuelle requise",
    borderEntry: "Entrée sur le territoire",
    maskedNote:
      "Les numéros de document restent masqués dans cette vérification. Les numéros complets ne sont chargés que dans la vue protégée de saisie manuelle. Rien n’est envoyé à eVisitor depuis cette page.",
    lastChanged: (date) => ` Dernière modification : ${date}.`,
    handoffTitle: "Saisie manuelle dans eVisitor",
    handoffDesc:
      "Vue protégée, non mise en cache. Recopiez ces valeurs manuellement ; RentTools ne contacte pas eVisitor.",
    close: "Fermer",
    stay: "Séjour",
    arrival: "Arrivée",
    guests: "Voyageurs",
  },
  es: {
    dateLocale: "es-ES",
    direct: "Directa",
    statusRevoked: "Enlace revocado",
    statusEvisitorConfirmed: "Registro manual en eVisitor confirmado",
    statusEvisitorReady: "Listo para el registro manual en eVisitor",
    statusOwnerApproved: "Datos de los huéspedes revisados y aprobados",
    statusOwnerReview: "Revisión del propietario en curso",
    statusGuestComplete: "Completado por el huésped — revisión del propietario sin iniciar",
    statusGuestStarted: "Iniciado por el huésped — datos incompletos",
    statusAwaitingGuest: "Esperando a que el huésped lo complete",
    submittedAgo: (d) =>
      d === 0 ? "Enviado hoy" : `Enviado hace ${d} ${d === 1 ? "día" : "días"}`,
    linkGeneratedAgo: (d) =>
      d === 0
        ? "Enlace generado hoy, esperando respuesta"
        : `Enlace generado hace ${d} ${d === 1 ? "día" : "días"}, esperando respuesta`,
    noAnswer: "Sin respuesta",
    yes: "Sí",
    no: "No",
    deleteConfirm: (name) =>
      `¿Eliminar la reserva «${name}»? Se eliminarán la reserva y los huéspedes y documentos de pasaporte asociados. Si se reclamó desde una reserva sincronizada, también se eliminará ese evento sincronizado.`,
    deleteReservation: "Eliminar reserva",
    grossAmountInvalid:
      "Introduzca un importe bruto no negativo con dos decimales como máximo y una moneda ISO válida.",
    storedGrossAmount: "Importe bruto guardado",
    unknown: "Desconocido",
    currency: "Moneda",
    grossAmountHint:
      "Importe opcional introducido por el propietario. Déjelo en blanco si no lo conoce; no se deduce ningún precio.",
    stayLength: (n, d) =>
      `${n} ${n === 1 ? "noche" : "noches"} · ${d} ${d === 1 ? "día" : "días"}`,
    guestsCount: (n) => `${n} ${n === 1 ? "huésped" : "huéspedes"}`,
    preArrivalForm: "Formulario previo a la llegada",
    shareHint:
      "Copie el enlace y compártalo con su huésped por WhatsApp, SMS o correo electrónico.",
    confirmedTravelers: "Viajeros confirmados",
    saved: "Guardado",
    enterRange: "Introduzca 1–50",
    requiredBeforeLink: "Obligatorio antes de generar el enlace",
    generating: "Generando…",
    linkCopied: "Enlace copiado",
    tryAgain: "Reintentar",
    copyLinkAgain: "Copiar el enlace de nuevo",
    copyFormLink: "Copiar enlace del formulario",
    startOwnerReview: "Iniciar revisión",
    approveCheckedData: "Aprobar datos revisados",
    prepareHandoff: "Preparar el registro manual en eVisitor",
    opening: "Abriendo…",
    openHandoff: "Abrir datos para el registro manual",
    confirmManualEntry: "Confirmar registro manual",
    revokeLink: "Revocar enlace",
    messenger: "Mensajería",
    messengerHint:
      "Guarde el teléfono del huésped para un chat personal, o pegue el enlace de un grupo para volver a él con un clic.",
    copyGroupName: "Copiar nombre del grupo",
    saveName: "Guardar nombre",
    resetToAuto: "Restablecer nombre automático",
    openTelegramGroup: "Abrir grupo de Telegram",
    openWhatsAppGroup: "Abrir grupo de WhatsApp",
    editLinks: "Editar enlaces",
    addGroupLinks: "Añadir enlaces de grupo",
    blankRemovesLink: "Deje un campo en blanco para eliminar el enlace guardado.",
    privacyNote:
      "Los documentos de pasaporte son privados de su cuenta. El soporte y los administradores de RentTools no pueden ver los datos de pasaporte que suba aquí.",
    noPassportData: "No se encontraron datos de pasaporte",
    networkError: "Error de red",
    extractedAll: (ok, total) => `${ok}/${total} pasaportes extraídos correctamente`,
    extractedPartial: (ok, total, failed) => `${ok}/${total} extraídos, ${failed} con error`,
    dismissSummary: "Cerrar resumen de extracción",
    generateMessageTitle: "Generar un mensaje a partir de una plantilla guardada",
    generateMessage: "Generar mensaje",
    exportCsvTitle: "Exportar todos los datos de los huéspedes a CSV",
    exportCsv: "Exportar CSV",
    closePreview: "Cerrar vista previa de la plantilla",
    preArrivalAnswers: "Respuestas previas a la llegada",
    registrationReview: "Revisión del registro de huéspedes",
    travelersCount: (n) => `${n} ${n === 1 ? "viajero" : "viajeros"}`,
    lead: "titular",
    born: "Nacimiento",
    gender: "Sexo",
    birthPlace: "Lugar de nacimiento",
    citizenship: "Nacionalidad",
    residence: "Residencia",
    document: "Documento",
    taxSuggestion: "Categoría de tasa sugerida",
    reviewRequired: "Requiere revisión",
    manualReviewRequired: "Requiere revisión manual",
    borderEntry: "Entrada en el país",
    maskedNote:
      "Los números de documento permanecen ocultos en esta revisión. Los números completos solo se cargan en la vista protegida para el registro manual. Desde aquí no se envía nada a eVisitor.",
    lastChanged: (date) => ` Último cambio: ${date}.`,
    handoffTitle: "Registro manual en eVisitor",
    handoffDesc:
      "Vista protegida sin caché. Copie estos valores manualmente; RentTools no contacta con eVisitor.",
    close: "Cerrar",
    stay: "Estancia",
    arrival: "Llegada",
    guests: "Huéspedes",
  },
  hr: {
    dateLocale: "hr-HR",
    direct: "Izravno",
    statusRevoked: "Link opozvan",
    statusEvisitorConfirmed: "Ručni unos u eVisitor potvrđen",
    statusEvisitorReady: "Spremno za ručni unos u eVisitor",
    statusOwnerApproved: "Podaci gostiju provjereni i odobreni",
    statusOwnerReview: "Provjera vlasnika u tijeku",
    statusGuestComplete: "Gost je ispunio obrazac — provjera vlasnika nije započela",
    statusGuestStarted: "Gost je počeo ispunjavati — podaci su nepotpuni",
    statusAwaitingGuest: "Čeka se da gost ispuni obrazac",
    submittedAgo: (d) =>
      d === 0
        ? "Poslano danas"
        : `Poslano prije ${d} ${hrPlural(d, "dan", "dana", "dana")}`,
    linkGeneratedAgo: (d) =>
      d === 0
        ? "Link stvoren danas, čeka se odgovor"
        : `Link stvoren prije ${d} ${hrPlural(d, "dan", "dana", "dana")}, čeka se odgovor`,
    noAnswer: "Nema odgovora",
    yes: "Da",
    no: "Ne",
    deleteConfirm: (name) =>
      `Obrisati rezervaciju „${name}”? Time se uklanjaju rezervacija i svi pripadajući gosti i dokumenti putovnica. Ako je preuzeta iz sinkronizirane rezervacije, uklanja se i taj sinkronizirani događaj.`,
    deleteReservation: "Obriši rezervaciju",
    grossAmountInvalid:
      "Unesite nenegativan bruto iznos s najviše dvije decimale i valjanu ISO valutu.",
    storedGrossAmount: "Spremljeni bruto iznos",
    unknown: "Nepoznato",
    currency: "Valuta",
    grossAmountHint:
      "Neobavezan iznos koji unosi vlasnik. Ostavite prazno ako nije poznat; cijena se ne izračunava automatski.",
    stayLength: (n, d) =>
      `${n} ${hrPlural(n, "noćenje", "noćenja", "noćenja")} · ${d} ${hrPlural(d, "dan", "dana", "dana")}`,
    guestsCount: (n) => `${n} ${hrPlural(n, "gost", "gosta", "gostiju")}`,
    preArrivalForm: "Obrazac prije dolaska",
    shareHint: "Kopirajte link i pošaljite ga gostu putem WhatsAppa, SMS-a ili e-pošte.",
    confirmedTravelers: "Potvrđeni broj putnika",
    saved: "Spremljeno",
    enterRange: "Unesite 1–50",
    requiredBeforeLink: "Obavezno prije stvaranja linka",
    generating: "Stvaranje…",
    linkCopied: "Link kopiran",
    tryAgain: "Pokušajte ponovno",
    copyLinkAgain: "Ponovno kopiraj link",
    copyFormLink: "Kopiraj link obrasca",
    startOwnerReview: "Započni provjeru",
    approveCheckedData: "Odobri provjerene podatke",
    prepareHandoff: "Pripremi podatke za ručni unos u eVisitor",
    opening: "Otvaranje…",
    openHandoff: "Otvori podatke za ručni unos",
    confirmManualEntry: "Potvrdi ručni unos",
    revokeLink: "Opozovi link",
    messenger: "Poruke",
    messengerHint:
      "Spremite gostov broj telefona za osobni razgovor ili zalijepite link grupe da joj se vratite jednim klikom.",
    copyGroupName: "Kopiraj naziv grupe",
    saveName: "Spremi naziv",
    resetToAuto: "Vrati automatski naziv",
    openTelegramGroup: "Otvori Telegram grupu",
    openWhatsAppGroup: "Otvori WhatsApp grupu",
    editLinks: "Uredi linkove",
    addGroupLinks: "Dodaj linkove grupa",
    blankRemovesLink: "Ostavite polje prazno da biste uklonili spremljeni link.",
    privacyNote:
      "Dokumenti putovnica vidljivi su samo vašem računu. Podrška i administratori RentToolsa ne mogu vidjeti podatke iz putovnica koje ovdje učitate.",
    noPassportData: "Nisu pronađeni podaci iz putovnice",
    networkError: "Mrežna pogreška",
    extractedAll: (ok, total) => `Uspješno izdvojeno putovnica: ${ok}/${total}`,
    extractedPartial: (ok, total, failed) => `Izdvojeno ${ok}/${total}, neuspješno: ${failed}`,
    dismissSummary: "Zatvori sažetak izdvajanja",
    generateMessageTitle: "Sastavi poruku iz spremljenog predloška",
    generateMessage: "Sastavi poruku",
    exportCsvTitle: "Izvezi sve podatke gostiju u CSV",
    exportCsv: "Izvezi CSV",
    closePreview: "Zatvori pregled predloška",
    preArrivalAnswers: "Odgovori prije dolaska",
    registrationReview: "Provjera prijave gostiju",
    travelersCount: (n) => `${n} ${hrPlural(n, "putnik", "putnika", "putnika")}`,
    lead: "nositelj rezervacije",
    born: "Datum rođenja",
    gender: "Spol",
    birthPlace: "Mjesto rođenja",
    citizenship: "Državljanstvo",
    residence: "Prebivalište",
    document: "Dokument",
    taxSuggestion: "Prijedlog kategorije pristojbe",
    reviewRequired: "Potrebna provjera",
    manualReviewRequired: "Potrebna ručna provjera",
    borderEntry: "Ulazak u zemlju",
    maskedNote:
      "Brojevi dokumenata u ovoj provjeri ostaju skriveni. Puni brojevi učitavaju se samo u zaštićenom prikazu za ručni unos. Odavde se ništa ne šalje u eVisitor.",
    lastChanged: (date) => ` Zadnja promjena: ${date}.`,
    handoffTitle: "Podaci za ručni unos u eVisitor",
    handoffDesc:
      "Zaštićeni prikaz koji se ne sprema u predmemoriju. Ove vrijednosti prepišite ručno; RentTools ne komunicira s eVisitorom.",
    close: "Zatvori",
    stay: "Boravak",
    arrival: "Dolazak",
    guests: "Gosti",
  },
};

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "processing";
}

interface MessageTemplate {
  id: number;
  propertyId: number;
  name: string;
  language: string;
  subject: string;
  body: string;
}

interface ManualEVisitorHandoff {
  submissionId: number;
  reservationId: number;
  status: "EVISITOR_READY" | "EVISITOR_CONFIRMED_MANUAL";
  stay: {
    checkIn: string;
    checkOut: string;
    bookedGuestCount: number;
    expectedArrivalTime: string;
    arrivalOrganization: string;
    serviceType: string;
  };
  travelers: Array<{
    isLead: boolean;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    citizenshipCountry: string;
    birthCountry: string;
    birthPlace: string;
    residenceCountry: string;
    residencePlace: string;
    residenceAddress: string;
    documentType: string;
    documentNumber: string;
    borderEntryDate?: string;
    borderEntryPlace?: string;
    borderEntryPoint?: string;
    taxCategorySuggestion?: string;
  }>;
}

/** Short platform label matching how hosts name messenger groups by
 *  hand — "Airbnb", "Booking" (without the .com), "Vrbo", etc. Distinct
 *  from `platformDisplayName` elsewhere in the app, which renders
 *  "Booking.com" with the TLD for SEO-facing surfaces. */
function platformShortLabel(slug: string): string {
  const map: Record<string, string> = {
    airbnb: "Airbnb",
    booking: "Booking",
    vrbo: "Vrbo",
    expedia: "Expedia",
    hostaway: "Hostaway",
    lodgify: "Lodgify",
    hospitable: "Hospitable",
    smoobu: "Smoobu",
    direct: "Direct",
    custom: "Direct",
  };
  if (map[slug]) return map[slug];
  if (!slug) return "Booking";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Stay date range formatted the way a host names a messenger group:
 *    same year + month         → "12-19 May 2026"
 *    same year, diff months    → "22 May-12 June 2026"
 *    different years           → "29 Dec 2026-3 Jan 2027"
 *  Months are full English names (matches the examples the user gave).
 */
function formatStayRange(checkInIso: string, checkOutIso: string): string {
  const ci = new Date(checkInIso);
  const co = new Date(checkOutIso);
  const ciDay = ci.getDate();
  const coDay = co.getDate();
  const ciMon = ci.toLocaleDateString("en-GB", { month: "long" });
  const coMon = co.toLocaleDateString("en-GB", { month: "long" });
  const ciYear = ci.getFullYear();
  const coYear = co.getFullYear();
  if (ciYear !== coYear) {
    return `${ciDay} ${ciMon} ${ciYear}-${coDay} ${coMon} ${coYear}`;
  }
  if (ci.getMonth() !== co.getMonth()) {
    return `${ciDay} ${ciMon}-${coDay} ${coMon} ${ciYear}`;
  }
  return `${ciDay}-${coDay} ${ciMon} ${ciYear}`;
}

/** True for iCal summaries that are generic host-blocks or "reserved"
 *  placeholders rather than a real guest name. Used to decide whether
 *  reservation.name is a trustworthy lead-guest identifier — a synced
 *  Airbnb reservation can arrive with "Reserved" or "Blocked" if the
 *  host hasn't claimed it via the bar-claim popover, and using that
 *  string as the group-chat name would be worse than falling back to
 *  passport data. Mirrors dashboard.tsx isGenericIcalName. */
function looksLikeGenericPlaceholder(s: string): boolean {
  const t = s.toLowerCase().trim();
  if (!t) return true;
  return (
    t === "reserved" ||
    t === "closed" ||
    t.includes("not available") ||
    t.includes("blocked") ||
    t.includes("closed - not available")
  );
}

/** Resolve the lead-guest first-name for a reservation, used by the
 *  group-chat name and the WhatsApp / Telegram messenger prefill.
 *
 *  Prefers `reservation.name` (the platform-sourced guest name — for
 *  synced Airbnb / Booking bookings, this is who the reservation was
 *  actually made under). Falls back to passport-extracted guests ONLY
 *  when reservation.name is missing or a generic-placeholder marker.
 *
 *  Previously the priority was inverted: the FIRST guest with a
 *  non-empty firstName won, and reservation.name was a last resort.
 *  That produced a wrong name whenever multiple passport guests were
 *  uploaded — the "first" one wasn't necessarily the lead. */
function resolveLeadGuestFirstName(
  reservation: Reservation,
  guests: Guest[],
): string {
  const resFirstToken = (reservation.name || "").split(" ")[0]?.trim() || "";
  if (resFirstToken && !looksLikeGenericPlaceholder(resFirstToken)) {
    return resFirstToken;
  }
  const guestWithFirst = guests.find((g) => g.firstName?.trim());
  const guestName =
    guestWithFirst?.firstName?.trim() ||
    guests[0]?.fullName?.trim() ||
    resFirstToken ||
    "";
  return guestName;
}

/** Format the standard group-chat name string the "Copy group name"
 *  button writes to the clipboard. Uses reservation.name as the
 *  authoritative lead-guest source, falling back to passport-extracted
 *  guests only for generic-placeholder reservation names. */
function formatGroupName(
  reservation: Reservation,
  guests: Guest[],
  propertyName: string | undefined,
): string {
  const platform = platformShortLabel(reservation.platform);
  const dates = formatStayRange(reservation.checkIn, reservation.checkOut);
  const guestName = resolveLeadGuestFirstName(reservation, guests) || "Guest";
  const prop = (propertyName ?? "Property").trim();
  return `${platform} ${dates} - ${guestName} - ${prop}`;
}

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : `{{${k}}}`
  );
}

interface ReservationViewProps {
  reservation: Reservation;
  guests: Guest[];
  propertyName?: string;
  bookingWindow: number;
  onGuestsUpdated: () => void;
  onDeleteGuest: (id: number) => void;
  onDeleteReservation: (
    id: number,
  ) =>
    | void
    | Promise<
        | void
        | { ok: true }
        | { ok: false; error: string }
      >;
  onUpdateReservation: (
    id: number,
    data: {
      name?: string;
      checkIn?: string;
      checkOut?: string;
      platform?: string;
      tgGroupUrl?: string | null;
      waGroupUrl?: string | null;
      groupName?: string | null;
      phone?: string | null;
      bookedGuestCount?: number | null;
      grossAmountCents?: number | null;
      currency?: string;
    }
  ) => void | Promise<{ ok: true } | { ok: false; error: string }>;
  onUpdateParent: (childId: number, parentId: number | null) => void;
  onUpdateGuest: (id: number, fields: Partial<Guest>) => Promise<void>;
}

export function ReservationView({
  reservation,
  guests,
  propertyName,
  bookingWindow,
  onGuestsUpdated,
  onDeleteGuest,
  onDeleteReservation,
  onUpdateReservation,
  onUpdateParent,
  onUpdateGuest,
}: ReservationViewProps) {
  const { locale, t: tr } = useI18n();
  // The legacy OCR path stores passport fields in the older Guest model and
  // remains disabled until its retention/deletion lifecycle is proven. The
  // unified encrypted pre-check-in form does not depend on this feature.
  const legacyPassportOcrEnabled = process.env.NEXT_PUBLIC_LEGACY_PASSPORT_OCR_ENABLED === "true";
  const hint = resolveCopy(HINT_COPY, locale);
  const c = resolveCopy(COPY, locale);
  const ownerCalendarWindow = useMemo(
    () => getOwnerCalendarWindow({
      bookingWindowDays: bookingWindow || 365,
      timeZone: DEFAULT_PROPERTY_TIME_ZONE,
    }),
    [bookingWindow],
  );
  const isDirectExtension = reservation.linkedEventRole === "extension";
  const sourcePlatformLabel = reservation.linkedEventPlatform
    ? platformShortLabel(reservation.linkedEventPlatform)
    : "synced";
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [extractionResult, setExtractionResult] = useState<{
    total: number;
    successful: number;
    files: { name: string; status: "success" | "failed"; reason?: string }[];
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(reservation.name);
  const [editCheckIn, setEditCheckIn] = useState(() =>
    toReservationDateInput(reservation.checkIn),
  );
  const [editCheckOut, setEditCheckOut] = useState(() =>
    toReservationDateInput(reservation.checkOut),
  );
  const [editGrossAmount, setEditGrossAmount] = useState(() =>
    reservation.grossAmountCents == null
      ? ""
      : (reservation.grossAmountCents / 100).toFixed(2),
  );
  const [editCurrency, setEditCurrency] = useState(reservation.currency ?? "EUR");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<MessageTemplate | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  // Per-reservation group-chat state: a button to copy the standardised
  // group-name string and an inline editor for the two messenger group
  // URLs the host saves once they've created the chat. Both come back
  // through the same PATCH /api/reservations/:id endpoint as the rest
  // of the editable fields.
  const [groupNameCopyState, setGroupNameCopyState] = useState<"idle" | "copied">("idle");
  // null = the host hasn't touched the group-name field this session
  // (field tracks the saved override or the live auto-name). A string
  // = an in-progress edit.
  const [groupNameOverride, setGroupNameOverride] = useState<string | null>(null);
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [editingGroupUrls, setEditingGroupUrls] = useState(false);
  const [editTgGroupUrl, setEditTgGroupUrl] = useState("");
  const [editWaGroupUrl, setEditWaGroupUrl] = useState("");
  const [savingGroupUrls, setSavingGroupUrls] = useState(false);
  const [groupUrlsError, setGroupUrlsError] = useState<string | null>(null);
  // Reservation-level contact phone. Same draft/saved/state pattern
  // the guest cards use for guest.phone — auto-saves on blur, server
  // normalises to loose E.164 ("+...digits..."), and surfaces a small
  // saved / error chip. Powers the personal-chat WhatsApp / Telegram
  // quick-buttons so a booking with no passport guests still gets a
  // one-click messenger jump.
  const [reservationPhoneDraft, setReservationPhoneDraft] = useState<string>(reservation.phone ?? "");
  const [reservationPhoneSaved, setReservationPhoneSaved] = useState<string>(reservation.phone ?? "");
  const [reservationPhoneState, setReservationPhoneState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [bookedGuestCountDraft, setBookedGuestCountDraft] = useState(
    reservation.bookedGuestCount ? String(reservation.bookedGuestCount) : "",
  );
  const [bookedGuestCountState, setBookedGuestCountState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    if (reservationPhoneDraft === reservationPhoneSaved) {
      setReservationPhoneDraft(reservation.phone ?? "");
      setReservationPhoneSaved(reservation.phone ?? "");
    } else {
      setReservationPhoneSaved(reservation.phone ?? "");
    }
  }, [reservation.phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setBookedGuestCountDraft(
      reservation.bookedGuestCount ? String(reservation.bookedGuestCount) : "",
    );
  }, [reservation.bookedGuestCount]);
  // RT-25.2 — pre-arrival guest form share link. hasGuestForm gates
  // the "Copy form link" button so it only shows when the property
  // actually has a template configured. The action is link-generation
  // + clipboard copy — RentTools doesn't send anything to the guest;
  // the host pastes the URL into WhatsApp / SMS / email themselves.
  const [hasGuestForm, setHasGuestForm] = useState(false);
  // True once the guest-form fetch has resolved — gates the
  // "not configured yet" hint so it doesn't flash during loading.
  const [guestFormChecked, setGuestFormChecked] = useState(false);
  const [guestFormGenerating, setGuestFormGenerating] = useState(false);
  const [guestFormCopyState, setGuestFormCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [guestFormSubmission, setGuestFormSubmission] = useState<{
    shareUrl: string | null;
    sentAt: string;
    submittedAt: string | null;
    status: "PENDING" | "GUEST_COMPLETE" | "OWNER_REVIEW" | "OWNER_APPROVED" | "EVISITOR_READY" | "EVISITOR_CONFIRMED_MANUAL" | "REVOKED" | "NOT_INVITED" | "INVITED" | "IN_PROGRESS" | "COMPLETE" | "OWNER_REVIEW_REQUIRED";
    expiresAt: string | null;
    revokedAt: string | null;
    ownerApprovedAt: string | null;
    lastChangedAt: string | null;
    travelerCount: number;
    warnings: string[];
    travelers: Array<{
      clientId: string;
      isLead: boolean;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: string;
      citizenshipCountry: string;
      birthCountry: string;
      birthPlace: string;
      residenceCountry: string;
      residencePlace: string;
      residenceAddress: string;
      documentType: string;
      documentNumberMasked: string;
      borderEntryDate?: string;
      borderEntryPlace?: string;
      borderEntryPoint?: string;
      taxCategorySuggestion?: string;
    }>;
    answers: { fieldId: string; type: string; label: string; value: unknown }[];
  } | null>(null);
  const [manualEVisitorHandoff, setManualEVisitorHandoff] =
    useState<ManualEVisitorHandoff | null>(null);
  const [manualEVisitorLoading, setManualEVisitorLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editCheckInInputRef = useRef<HTMLInputElement>(null);
  const editNameTriggerRef = useRef<HTMLButtonElement>(null);
  const editDatesTriggerRef = useRef<HTMLButtonElement>(null);
  const editInitialFocusRef = useRef<"name" | "dates">("name");
  const editReturnFocusRef = useRef<"name" | "dates">("name");
  const shouldRestoreEditFocusRef = useRef(false);

  // Keep the drafts aligned with a refetch after a successful PATCH,
  // while never overwriting what the host is currently typing.
  useEffect(() => {
    if (editing) return;
    setEditName(reservation.name);
    setEditCheckIn(toReservationDateInput(reservation.checkIn));
    setEditCheckOut(toReservationDateInput(reservation.checkOut));
    setEditGrossAmount(
      reservation.grossAmountCents == null
        ? ""
        : (reservation.grossAmountCents / 100).toFixed(2),
    );
    setEditCurrency(reservation.currency ?? "EUR");
  }, [
    editing,
    reservation.name,
    reservation.checkIn,
    reservation.checkOut,
    reservation.grossAmountCents,
    reservation.currency,
  ]);

  // Opening the inline editor removes the invoking button from the DOM.
  // Move focus into the relevant field, then return it to the same
  // trigger after Cancel or a successful save.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (editing) {
        const field =
          editInitialFocusRef.current === "dates"
            ? editCheckInInputRef.current
            : editNameInputRef.current;
        field?.focus();
        return;
      }
      if (!shouldRestoreEditFocusRef.current) return;
      shouldRestoreEditFocusRef.current = false;
      const trigger =
        editReturnFocusRef.current === "dates"
          ? editDatesTriggerRef.current
          : editNameTriggerRef.current;
      trigger?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editing]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/message-templates?propertyId=${reservation.propertyId}`)
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => {
        if (!cancelled) setTemplates((d.templates || []) as MessageTemplate[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reservation.propertyId]);

  useEffect(() => {
    if (!templatePickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setTemplatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [templatePickerOpen]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/properties/${reservation.propertyId}/guest-form`)
      .then((r) => (r.ok ? r.json() : { template: null }))
      .then((d) => {
        if (!cancelled) {
          setHasGuestForm(!!d.template);
          setGuestFormChecked(true);
        }
      })
      .catch(() => { if (!cancelled) setGuestFormChecked(true); });
    return () => {
      cancelled = true;
    };
  }, [reservation.propertyId]);

  const refreshGuestFormSubmission = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/guest-form/share`);
      if (!res.ok) return;
      const d = await res.json();
      setGuestFormSubmission(d.submission ?? null);
    } catch {
      // ignore
    }
  }, [reservation.id]);

  useEffect(() => {
    refreshGuestFormSubmission();
  }, [refreshGuestFormSubmission]);

  // Generate (or reuse) the guest's pre-arrival form share URL and
  // place it on the clipboard. RentTools does NOT send anything to the
  // guest — the host pastes the URL into WhatsApp / SMS / email
  // themselves. The endpoint is idempotent on second call: returns the
  // same shareUrl that was minted the first time.
  const copyGuestFormLink = async () => {
    setGuestFormCopyState("idle");

    // Fast path — the share URL is already known (the link was minted
    // earlier). Copy it straight away: writeText is called inside the
    // tap, so mobile Safari keeps clipboard permission.
    if (guestFormSubmission?.shareUrl) {
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}${guestFormSubmission.shareUrl}`,
        );
        setGuestFormCopyState("copied");
        setTimeout(() => setGuestFormCopyState("idle"), 2500);
      } catch {
        setGuestFormCopyState("error");
      }
      return;
    }

    // First time — the URL has to be minted by the API. A plain
    // `await fetch(...)` then `clipboard.writeText` fails on mobile
    // Safari: the tap's activation is spent by the time writeText
    // runs. Instead hand clipboard.write() a Promise — ClipboardItem
    // accepts one, so the write is registered inside the tap and
    // fulfilled when the URL arrives. Browsers without ClipboardItem
    // fall back to the await-then-writeText path.
    setGuestFormGenerating(true);
    const urlPromise = fetch(`/api/reservations/${reservation.id}/guest-form/share`, {
      method: "POST",
    })
      .then((res) => {
        if (!res.ok) throw new Error("share request failed");
        return res.json();
      })
      .then((data) => `${window.location.origin}${data.shareUrl}`);

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": urlPromise.then(
              (url) => new Blob([url], { type: "text/plain" }),
            ),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(await urlPromise);
      }
      setGuestFormCopyState("copied");
      setTimeout(() => setGuestFormCopyState("idle"), 2500);
    } catch {
      setGuestFormCopyState("error");
    } finally {
      setGuestFormGenerating(false);
      refreshGuestFormSubmission();
    }
  };

  const guestFormStatusLabel = (): string | null => {
    if (!guestFormSubmission) return null;
    if (guestFormSubmission.status === "REVOKED") return c.statusRevoked;
    if (guestFormSubmission.status === "EVISITOR_CONFIRMED_MANUAL") return c.statusEvisitorConfirmed;
    if (guestFormSubmission.status === "EVISITOR_READY") return c.statusEvisitorReady;
    if (guestFormSubmission.status === "OWNER_APPROVED") return c.statusOwnerApproved;
    if (guestFormSubmission.status === "OWNER_REVIEW" || guestFormSubmission.status === "OWNER_REVIEW_REQUIRED") return c.statusOwnerReview;
    if (guestFormSubmission.status === "GUEST_COMPLETE" || guestFormSubmission.status === "COMPLETE") return c.statusGuestComplete;
    if (guestFormSubmission.status === "IN_PROGRESS") return c.statusGuestStarted;
    if (guestFormSubmission.status === "PENDING" || guestFormSubmission.status === "INVITED" || guestFormSubmission.status === "NOT_INVITED") return c.statusAwaitingGuest;
    if (guestFormSubmission.submittedAt) {
      const days = Math.max(
        0,
        Math.round(
          (Date.now() - new Date(guestFormSubmission.submittedAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      return c.submittedAgo(days);
    }
    // Avoid the word "Sent" — RentTools doesn't send the link, the host
    // does. We only know when the share token was minted (i.e. when the
    // link was first copied to the clipboard).
    const days = Math.max(
      0,
      Math.round(
        (Date.now() - new Date(guestFormSubmission.sentAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    return c.linkGeneratedAgo(days);
  };

  const updateGuestFormStatus = async (
    action:
      | "start-review"
      | "approve"
      | "mark-evisitor-ready"
      | "confirm-evisitor-manual"
      | "revoke",
  ) => {
    setGuestFormCopyState("idle");
    try {
      const response = await fetch(`/api/reservations/${reservation.id}/guest-form/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("status update failed");
      setManualEVisitorHandoff(null);
      await refreshGuestFormSubmission();
    } catch {
      setGuestFormCopyState("error");
    }
  };

  const openManualEVisitorHandoff = async () => {
    setGuestFormCopyState("idle");
    setManualEVisitorLoading(true);
    try {
      const response = await fetch(
        `/api/reservations/${reservation.id}/guest-form/handoff`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("handoff request failed");
      setManualEVisitorHandoff(await response.json());
    } catch {
      setGuestFormCopyState("error");
      setManualEVisitorHandoff(null);
    } finally {
      setManualEVisitorLoading(false);
    }
  };

  const renderGuestFormAnswerValue = (a: { type: string; value: unknown }) => {
    if (a.value === null || a.value === undefined || a.value === "") {
      return <span className="text-muted-foreground italic">{c.noAnswer}</span>;
    }
    if (Array.isArray(a.value)) return a.value.join(", ");
    if (a.type === "yes-no") return a.value === "yes" ? c.yes : c.no;
    return String(a.value);
  };

  const formatIsoDate = (s: string) => new Date(s).toISOString().split("T")[0];

  const templateVars = (): Record<string, string> => ({
    guestName: reservation.name,
    checkIn: formatIsoDate(reservation.checkIn),
    checkOut: formatIsoDate(reservation.checkOut),
    propertyName: propertyName || "",
    wifiPassword: "",
  });

  const renderedSubject = activeTemplate
    ? renderTemplate(activeTemplate.subject, templateVars())
    : "";
  const renderedBody = activeTemplate
    ? renderTemplate(activeTemplate.body, templateVars())
    : "";

  const pickTemplate = (t: MessageTemplate) => {
    setActiveTemplate(t);
    setTemplatePickerOpen(false);
    setCopyState("idle");
  };

  const copyMessage = async () => {
    if (!activeTemplate) return;
    const text = renderedSubject
      ? `${renderedSubject}\n\n${renderedBody}`
      : renderedBody;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // clipboard blocked — fall back to selecting the textarea
      const ta = document.getElementById("rendered-message-body") as HTMLTextAreaElement | null;
      ta?.select();
    }
  };

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, { time, message, type }]);
    setTimeout(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    },
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const extractData = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);
    setLogs([]);
    setExtractionResult(null);

    addLog(`Starting extraction for ${files.length} file(s)...`, "info");
    const fileResults: { name: string; status: "success" | "failed"; reason?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeFileLabel = `document-${i + 1}`;
      addLog(`[${i + 1}/${files.length}] Processing secure document (${(file.size / 1024).toFixed(1)} KB)`, "processing");

      try {
        const formData = new FormData();
        formData.append("files", file);
        formData.append("reservationId", reservation.id.toString());

        addLog(`[${i + 1}/${files.length}] Sending to Gemini Vision API...`, "processing");

        const response = await fetch("/api/extract", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const reason = errData.error || `HTTP ${response.status}`;
          addLog(`[${i + 1}/${files.length}] Failed: ${reason}`, "error");
          fileResults.push({ name: safeFileLabel, status: "failed", reason });
          continue;
        }

        const json = await response.json();
        const count = json.data?.length || 0;

        if (count > 0) {
          addLog(`[${i + 1}/${files.length}] Extracted ${count} traveler record(s)`, "success");
          fileResults.push({ name: safeFileLabel, status: "success" });
        } else {
          addLog(`[${i + 1}/${files.length}] No passport data found`, "error");
          fileResults.push({ name: safeFileLabel, status: "failed", reason: c.noPassportData });
        }
      } catch {
        addLog(`[${i + 1}/${files.length}] Network error processing secure document`, "error");
        fileResults.push({ name: safeFileLabel, status: "failed", reason: c.networkError });
      }
    }

    addLog("Extraction complete.", "info");
    const successful = fileResults.filter((r) => r.status === "success").length;
    setExtractionResult({ total: fileResults.length, successful, files: fileResults });
    setFiles([]);
    setLoading(false);
    onGuestsUpdated();
  };

  // Effective group name shown + copied: the host's saved override
  // (reservation.groupName) if set, otherwise the auto-generated one.
  // `groupNameOverride` holds the in-progress edit — null until the
  // host starts typing, so the field tracks the live auto-name (which
  // updates as guests finish loading) until they take control of it.
  const autoGroupName = formatGroupName(reservation, guests, propertyName);
  const groupNameValue = groupNameOverride ?? reservation.groupName ?? autoGroupName;

  const handleCopyGroupName = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(groupNameValue);
      setGroupNameCopyState("copied");
      setTimeout(() => setGroupNameCopyState("idle"), 2000);
    } catch {
      // Clipboard write can fail in non-secure contexts. Silent — the
      // visible group-name field right below the button is the
      // fallback the host can manually select.
    }
  }, [groupNameValue]);

  const handleSaveGroupName = async () => {
    if (groupNameOverride === null) return;
    setSavingGroupName(true);
    await Promise.resolve(
      // Empty string clears the override (PATCH maps "" → null), so the
      // bar falls back to the auto-generated name.
      onUpdateReservation(reservation.id, { groupName: groupNameOverride.trim() }),
    );
    setSavingGroupName(false);
    setGroupNameOverride(null);
  };

  const handleSaveGroupUrls = async () => {
    setSavingGroupUrls(true);
    setGroupUrlsError(null);
    const result = await Promise.resolve(
      onUpdateReservation(reservation.id, {
        tgGroupUrl: editTgGroupUrl.trim() ? editTgGroupUrl.trim() : null,
        waGroupUrl: editWaGroupUrl.trim() ? editWaGroupUrl.trim() : null,
      }),
    );
    setSavingGroupUrls(false);
    if (result && typeof result === "object" && "ok" in result && !result.ok) {
      setGroupUrlsError(result.error);
      return;
    }
    setEditingGroupUrls(false);
  };

  const handleReservationPhoneBlur = async () => {
    if (reservationPhoneDraft === reservationPhoneSaved) return;
    setReservationPhoneState("saving");
    const result = await Promise.resolve(
      onUpdateReservation(reservation.id, { phone: reservationPhoneDraft }),
    );
    if (result && typeof result === "object" && "ok" in result && !result.ok) {
      setReservationPhoneState("error");
      return;
    }
    // Server normalises ("+", digits only) — the next render via
    // reservation.phone reconciles our draft to the canonical form.
    setReservationPhoneSaved(reservationPhoneDraft);
    setReservationPhoneState("saved");
    setTimeout(
      () => setReservationPhoneState((s) => (s === "saved" ? "idle" : s)),
      1600,
    );
  };

  const handleBookedGuestCountBlur = async () => {
    const parsed = Number(bookedGuestCountDraft);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      setBookedGuestCountState("error");
      return;
    }
    if (parsed === reservation.bookedGuestCount) return;
    setBookedGuestCountState("saving");
    const result = await Promise.resolve(
      onUpdateReservation(reservation.id, { bookedGuestCount: parsed }),
    );
    if (result && typeof result === "object" && "ok" in result && !result.ok) {
      setBookedGuestCountState("error");
      return;
    }
    setBookedGuestCountState("saved");
    setTimeout(
      () => setBookedGuestCountState((state) => state === "saved" ? "idle" : state),
      1600,
    );
  };

  // wa.me wants plain digits without `+`; t.me/+phone needs the leading
  // `+` so the deeplink resolves. Mirror the same gating the guest card
  // applies so the buttons stay disabled until the input parses cleanly.
  const reservationPhoneForLinks = (reservationPhoneDraft || reservation.phone || "").trim();
  const reservationPhoneEnabled =
    reservationPhoneForLinks.length > 0 &&
    /^\+?\d{7,15}$/.test(reservationPhoneForLinks);
  const reservationWaDigits = reservationPhoneForLinks.replace(/^\+/, "");
  const reservationTmePath = reservationPhoneForLinks.startsWith("+")
    ? reservationPhoneForLinks
    : `+${reservationPhoneForLinks}`;
  const reservationLeadFirstName = resolveLeadGuestFirstName(reservation, guests);
  const reservationCheckInDate = (() => {
    const d = new Date(reservation.checkIn);
    return isNaN(d.getTime())
      ? reservation.checkIn
      : d.toISOString().split("T")[0];
  })();
  const reservationMessengerPrefill = tr("guest.messengerPrefill", {
    name: reservationLeadFirstName,
    property: propertyName || "",
    checkIn: reservationCheckInDate,
  });

  const beginEditing = (target: "name" | "dates") => {
    setEditName(reservation.name);
    setEditCheckIn(toReservationDateInput(reservation.checkIn));
    setEditCheckOut(toReservationDateInput(reservation.checkOut));
    setEditGrossAmount(
      reservation.grossAmountCents == null
        ? ""
        : (reservation.grossAmountCents / 100).toFixed(2),
    );
    setEditCurrency(reservation.currency ?? "EUR");
    setEditError(null);
    editInitialFocusRef.current = target;
    editReturnFocusRef.current = target;
    setEditing(true);
  };

  const closeEditing = () => {
    shouldRestoreEditFocusRef.current = true;
    setEditing(false);
  };

  const cancelEditing = () => {
    if (editSaving) return;
    setEditError(null);
    closeEditing();
  };

  const handleDeleteReservation = async () => {
    const confirmed = isDirectExtension
      ? window.confirm(
          tr("reservation.cancelExtensionConfirm", {
            name: reservation.name,
            platform: sourcePlatformLabel,
          }),
        )
      : window.confirm(c.deleteConfirm(reservation.name));
    if (!confirmed) return;

    setDeletePending(true);
    setDeleteError(null);
    try {
      const result = await Promise.resolve(onDeleteReservation(reservation.id));
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        setDeleteError(
          isDirectExtension
            ? tr("reservation.cancelExtensionFailed")
            : result.error,
        );
      }
    } catch {
      setDeleteError(
        isDirectExtension
          ? tr("reservation.cancelExtensionFailed")
          : tr("reservation.saveFailed"),
      );
    } finally {
      setDeletePending(false);
    }
  };

  const editDateRangeError = validateReservationDateRange(editCheckIn, editCheckOut);
  const editDateRangeMessage = (() => {
    switch (editDateRangeError) {
      case "required":
        return tr("reservation.dateRangeRequired");
      case "invalid-check-in":
        return tr("reservation.invalidCheckIn");
      case "invalid-check-out":
        return tr("reservation.invalidCheckOut");
      case "invalid-range":
        return tr("reservation.invalidDateRange");
      default:
        return null;
    }
  })();

  const localizeEditError = (message: string) => {
    if (message === "Overlapping reservation exists") {
      return tr("reservation.manualOverlap");
    }
    if (message === "Overlapping booking from another platform") {
      return tr("reservation.syncedOverlap");
    }
    if (message === "Linked booking relationship cannot be changed") {
      return tr("reservation.linkedRelationship");
    }
    if (message === "checkOut must be after checkIn") {
      return tr("reservation.invalidDateRange");
    }
    if (message === "Invalid checkIn date") {
      return tr("reservation.invalidCheckIn");
    }
    if (message === "Invalid checkOut date") {
      return tr("reservation.invalidCheckOut");
    }
    return tr("reservation.saveFailed");
  };

  const handleSaveEdit = async () => {
    if (editDateRangeError || !editName.trim()) return;

    const parsedGrossAmount = parseGrossAmountText(editGrossAmount);
    const normalizedCurrency = normalizeCurrencyCode(editCurrency);
    if (!parsedGrossAmount.ok || !normalizedCurrency) {
      setEditError(c.grossAmountInvalid);
      return;
    }

    const data: Parameters<typeof onUpdateReservation>[1] = {};
    const nextName = editName.trim();
    const currentCheckIn = toReservationDateInput(reservation.checkIn);
    const currentCheckOut = toReservationDateInput(reservation.checkOut);
    if (nextName !== reservation.name) data.name = nextName;
    if (editCheckIn !== currentCheckIn) data.checkIn = editCheckIn;
    if (editCheckOut !== currentCheckOut) data.checkOut = editCheckOut;
    if (parsedGrossAmount.cents !== (reservation.grossAmountCents ?? null)) {
      data.grossAmountCents = parsedGrossAmount.cents;
    }
    if (normalizedCurrency !== (reservation.currency ?? "EUR")) {
      data.currency = normalizedCurrency;
    }

    if (Object.keys(data).length === 0) {
      closeEditing();
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const result = await Promise.resolve(onUpdateReservation(reservation.id, data));
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        setEditError(localizeEditError(result.error));
        return;
      }
      closeEditing();
    } catch {
      setEditError(tr("reservation.saveFailed"));
    } finally {
      setEditSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(c.dateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const exportGuestsCsv = () => {
    if (guests.length === 0) return;

    const headers: (keyof Guest)[] = [
      "id",
      "fullName",
      "firstName",
      "lastName",
      "country",
      "citizenshipCode",
      "dateOfBirth",
      "yearsOld",
      "gender",
      "dateOfIssue",
      "expiryDate",
      "passportNumber",
      "issuedBy",
      "hasVisa",
      "visaNumber",
      "visaFrom",
      "visaTo",
      "parentId",
    ];

    const escape = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      const s = String(val);
      // RFC 4180: quote field if it contains comma, quote, CR or LF; double internal quotes
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = [
      headers.join(","),
      ...guests.map((g) => headers.map((h) => escape(g[h])).join(",")),
    ];
    // BOM so Excel detects UTF-8 correctly
    const csv = "﻿" + rows.join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date(reservation.checkIn).toISOString().split("T")[0];
    const safeName = reservation.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
    a.download = `guests-${safeName}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stayNights = () => {
    return reservationNights(reservation.checkIn, reservation.checkOut);
  };
  const stayDays = () => stayNights() + 1;

  return (
    <div className="-mx-3 sm:-mx-6 lg:-mx-8">
    <div className="mx-auto max-w-[1760px] space-y-6 px-3 sm:px-5">
      {/* Reservation Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="space-y-4 rounded-xl border border-border/60 bg-card/50 p-4"
              aria-busy={editSaving}
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveEdit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancelEditing();
              }}
            >
              <div>
                <h2 className="text-base font-semibold">{tr("reservation.edit")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tr("reservation.editDescription")}
                </p>
              </div>

              <label className="block space-y-1.5" htmlFor={`reservation-name-${reservation.id}`}>
                <span className="text-sm font-medium">{tr("reservation.name")}</span>
                <input
                  ref={editNameInputRef}
                  id={`reservation-name-${reservation.id}`}
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditError(null);
                  }}
                  required
                  disabled={editSaving}
                  className="h-11 w-full rounded-lg border border-border/60 bg-background px-3 text-base font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:text-sm"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 space-y-1.5" htmlFor={`reservation-check-in-${reservation.id}`}>
                  <span className="text-sm font-medium">{tr("reservation.checkIn")}</span>
                  <input
                    ref={editCheckInInputRef}
                    id={`reservation-check-in-${reservation.id}`}
                    type="date"
                    value={editCheckIn}
                    min={ownerCalendarWindow.visibleFrom}
                    max={editCheckOut && editCheckOut < ownerCalendarWindow.visibleUntil
                      ? editCheckOut
                      : ownerCalendarWindow.visibleUntil}
                    onChange={(e) => {
                      setEditCheckIn(e.target.value);
                      setEditError(null);
                    }}
                    required
                    disabled={editSaving}
                    aria-invalid={editDateRangeError === "invalid-check-in" || editDateRangeError === "invalid-range"}
                    className="h-11 w-full min-w-0 rounded-lg border border-border/60 bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:text-sm"
                  />
                </label>
                <label className="block min-w-0 space-y-1.5" htmlFor={`reservation-check-out-${reservation.id}`}>
                  <span className="text-sm font-medium">{tr("reservation.checkOut")}</span>
                  <input
                    id={`reservation-check-out-${reservation.id}`}
                    type="date"
                    value={editCheckOut}
                    min={editCheckIn || undefined}
                    max={ownerCalendarWindow.checkoutUntil}
                    onChange={(e) => {
                      setEditCheckOut(e.target.value);
                      setEditError(null);
                    }}
                    required
                    disabled={editSaving}
                    aria-invalid={editDateRangeError === "invalid-check-out" || editDateRangeError === "invalid-range"}
                    className="h-11 w-full min-w-0 rounded-lg border border-border/60 bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
                <label className="block min-w-0 space-y-1.5" htmlFor={`reservation-gross-amount-${reservation.id}`}>
                  <span className="text-sm font-medium">{c.storedGrossAmount}</span>
                  <input
                    id={`reservation-gross-amount-${reservation.id}`}
                    type="text"
                    inputMode="decimal"
                    value={editGrossAmount}
                    placeholder={c.unknown}
                    onChange={(event) => {
                      setEditGrossAmount(event.target.value);
                      setEditError(null);
                    }}
                    disabled={editSaving}
                    className="h-11 w-full min-w-0 rounded-lg border border-border/60 bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:text-sm"
                  />
                </label>
                <label className="block min-w-0 space-y-1.5" htmlFor={`reservation-currency-${reservation.id}`}>
                  <span className="text-sm font-medium">{c.currency}</span>
                  <input
                    id={`reservation-currency-${reservation.id}`}
                    type="text"
                    value={editCurrency}
                    maxLength={3}
                    onChange={(event) => {
                      setEditCurrency(event.target.value.toUpperCase());
                      setEditError(null);
                    }}
                    disabled={editSaving}
                    className="h-11 w-full rounded-lg border border-border/60 bg-background px-3 text-center text-base uppercase outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:text-sm"
                  />
                </label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {c.grossAmountHint}
              </p>

              {reservation.linkedEventUid && (
                <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-700 dark:text-sky-300">
                  {isDirectExtension
                    ? tr("reservation.extensionSafetyHint")
                    : tr("reservation.syncedDateHint")}
                </p>
              )}

              {(editError || editDateRangeMessage) && (
                <p role="alert" className="text-sm text-destructive">
                  {editError || editDateRangeMessage}
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg px-4"
                  onClick={cancelEditing}
                  disabled={editSaving}
                >
                  {tr("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  className="h-11 rounded-lg px-4"
                  disabled={editSaving || !!editDateRangeError || !editName.trim()}
                >
                  {editSaving ? tr("reservation.saving") : tr("common.save")}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold tracking-tight">
                  {reservation.name}
                </h1>
                <button
                  ref={editNameTriggerRef}
                  type="button"
                  onClick={() => beginEditing("name")}
                  aria-label={tr("reservation.edit")}
                  title={tr("reservation.edit")}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteReservation()}
                  disabled={deletePending}
                  aria-busy={deletePending}
                  aria-label={isDirectExtension ? tr("reservation.cancelExtension") : c.deleteReservation}
                  title={isDirectExtension ? tr("reservation.cancelExtension") : c.deleteReservation}
                  className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 disabled:cursor-wait disabled:opacity-60 ${
                    isDirectExtension
                      ? "border border-rose-500/30 text-xs font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                      : "w-11 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  {isDirectExtension && <span>{tr("reservation.cancelExtension")}</span>}
                </button>
              </div>
              {deleteError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {deleteError}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  reservation.platform === "booking"
                    ? "bg-[#003580]/20 text-sky-500"
                    : reservation.platform === "airbnb"
                      ? "bg-[var(--m-accent)]/10 text-[var(--m-accent)]"
                      : "bg-slate-500/10 text-slate-600 dark:text-slate-300"
                }`}>
                  {reservation.platform === "direct" || reservation.platform === "custom"
                    ? c.direct
                    : platformShortLabel(reservation.platform)}
                </span>
                {isDirectExtension && (
                  <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                    {tr("reservation.connectedToSource", { platform: sourcePlatformLabel })}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDate(reservation.checkIn)} — {formatDate(reservation.checkOut)}
                </span>
                <Badge variant="outline" className="rounded-md text-xs">
                  {c.stayLength(stayNights(), stayDays())}
                </Badge>
                <Button
                  ref={editDatesTriggerRef}
                  type="button"
                  variant="outline"
                  onClick={() => beginEditing("dates")}
                  className="h-11 rounded-lg px-3 text-xs"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M5.25 4.5h13.5a1.5 1.5 0 011.5 1.5v12.75a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5zM14.25 12.75l3-3m-2.25 5.25l-2.25.75.75-2.25 3-3 1.5 1.5-3 3z" />
                  </svg>
                  {tr("reservation.editDates")}
                </Button>
                {guests.length > 0 && (
                  <Badge variant="secondary" className="rounded-md text-xs">
                    {c.guestsCount(guests.length)}
                  </Badge>
                )}
              </div>
              {isDirectExtension && (
                <div className="mt-3 rounded-xl border border-slate-500/20 bg-slate-500/5 px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    {tr("reservation.directExtension")}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {tr("reservation.extensionSafetyHint")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Below the header, a two-column row. The reservation tools
          (pre-arrival form + group chat) sit in a sidebar; the passport
          upload and guest list — the primary task — take the wide main
          column. flex-col-reverse keeps the main column first on mobile
          while flex-row-reverse puts it on the left at desktop width. */}
      <div className="flex flex-col-reverse gap-6 lg:flex-row-reverse">
        <aside className="w-full space-y-4 lg:w-[380px] lg:shrink-0">

      {/* RT-25.2 — Pre-arrival form share link. Hidden when the property
          has no GuestFormTemplate configured (set up under Sync Settings).
          Action is generate + copy: RentTools doesn't send anything to
          the guest. The host pastes the link into WhatsApp / SMS / email
          themselves. */}
      {hasGuestForm && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{c.preArrivalForm}</p>
            <p className="text-xs text-muted-foreground">
              {guestFormStatusLabel() ?? c.shareHint}
            </p>
          </div>
          <label className="w-full text-xs text-muted-foreground">
            {c.confirmedTravelers}
            <input
              type="number"
              min={1}
              max={50}
              value={bookedGuestCountDraft}
              onChange={(event) => {
                setBookedGuestCountDraft(event.target.value);
                setBookedGuestCountState("idle");
              }}
              onBlur={handleBookedGuestCountBlur}
              className="mt-1 h-9 w-28 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground"
              aria-label={c.confirmedTravelers}
            />
            <span className="ml-2">
              {bookedGuestCountState === "saving" ? tr("reservation.saving") : bookedGuestCountState === "saved" ? c.saved : bookedGuestCountState === "error" ? c.enterRange : c.requiredBeforeLink}
            </span>
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copyGuestFormLink}
            disabled={guestFormGenerating || !reservation.bookedGuestCount}
            className="rounded-lg text-xs"
          >
            {guestFormGenerating
              ? c.generating
              : guestFormCopyState === "copied"
                ? c.linkCopied
                : guestFormCopyState === "error"
                  ? c.tryAgain
                  : guestFormSubmission
                    ? c.copyLinkAgain
                    : c.copyFormLink}
          </Button>
          {(guestFormSubmission?.status === "GUEST_COMPLETE" ||
            guestFormSubmission?.status === "COMPLETE") && (
            <Button
              type="button"
              size="sm"
              onClick={() => updateGuestFormStatus("start-review")}
              className="rounded-lg text-xs"
            >
              {c.startOwnerReview}
            </Button>
          )}
          {(guestFormSubmission?.status === "OWNER_REVIEW" ||
            guestFormSubmission?.status === "OWNER_REVIEW_REQUIRED") && (
            <Button
              type="button"
              size="sm"
              onClick={() => updateGuestFormStatus("approve")}
              className="rounded-lg text-xs"
            >
              {c.approveCheckedData}
            </Button>
          )}
          {guestFormSubmission?.status === "OWNER_APPROVED" && (
            <Button
              type="button"
              size="sm"
              onClick={() => updateGuestFormStatus("mark-evisitor-ready")}
              className="rounded-lg text-xs"
            >
              {c.prepareHandoff}
            </Button>
          )}
          {(guestFormSubmission?.status === "EVISITOR_READY" ||
            guestFormSubmission?.status === "EVISITOR_CONFIRMED_MANUAL") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openManualEVisitorHandoff}
              disabled={manualEVisitorLoading}
              className="rounded-lg text-xs"
            >
              {manualEVisitorLoading ? c.opening : c.openHandoff}
            </Button>
          )}
          {guestFormSubmission?.status === "EVISITOR_READY" && (
            <Button
              type="button"
              size="sm"
              onClick={() => updateGuestFormStatus("confirm-evisitor-manual")}
              className="rounded-lg text-xs"
            >
              {c.confirmManualEntry}
            </Button>
          )}
          {guestFormSubmission && guestFormSubmission.status !== "REVOKED" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => updateGuestFormStatus("revoke")}
              className="rounded-lg text-xs text-rose-300"
            >
              {c.revokeLink}
            </Button>
          )}
        </div>
      )}

      {/* Discovery hint — the property has no pre-arrival form template
          yet, so the section above is hidden. Many hosts never set one
          up simply because they don't know it exists. A one-line, low-
          key note surfaces the feature without nagging: a host who
          doesn't want it just reads past it. */}
      {guestFormChecked && !hasGuestForm && (
        <div className="rounded-xl border border-dashed border-border/50 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{hint.title}</span>{" "}
            {hint.before}{" "}
            <Link
              href={`/dashboard?property=${reservation.propertyId}&view=guest-form`}
              className="font-medium text-[var(--m-accent)] underline underline-offset-2 hover:text-[var(--m-accent-2)]"
            >
              {hint.link}
            </Link>
            {hint.after}
          </p>
        </div>
      )}

      {/* Reservation-level messenger. Two paths: (a) save a phone here
          and use the WhatsApp / Telegram quick-buttons to open a personal
          chat — works even without passport guests, even with one guest;
          (b) paste a group-chat URL after you've created one, plus copy
          a standard group-name string so chats look consistent in your
          messenger list. */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{c.messenger}</p>
            <p className="text-xs text-muted-foreground">
              {c.messengerHint}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyGroupName}
            className="rounded-lg text-xs"
          >
            {groupNameCopyState === "copied" ? tr("common.copied") : c.copyGroupName}
          </Button>
        </div>

        {/* Personal chat — phone input + WA / TG quick-message buttons.
            Auto-saves on blur via the same PATCH path as the group URL
            fields below; the server normalises to loose E.164. */}
        <div className="space-y-1 border-t border-border/30 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tr("guest.phone")}
            </span>
            <span
              className={`text-[10px] transition-opacity ${reservationPhoneState === "idle" ? "opacity-0" : "opacity-100"} ${
                reservationPhoneState === "saved"
                  ? "text-emerald-500"
                  : reservationPhoneState === "error"
                    ? "text-destructive"
                    : "text-muted-foreground/60"
              }`}
            >
              {reservationPhoneState === "saving"
                ? tr("reservation.saving")
                : reservationPhoneState === "saved"
                  ? c.saved
                  : reservationPhoneState === "error"
                    ? tr("guest.phoneInvalid")
                    : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="tel"
              inputMode="tel"
              value={reservationPhoneDraft}
              onChange={(e) => {
                setReservationPhoneDraft(e.target.value);
                if (reservationPhoneState === "saved" || reservationPhoneState === "error") {
                  setReservationPhoneState("idle");
                }
              }}
              onBlur={handleReservationPhoneBlur}
              placeholder={tr("guest.phonePlaceholder")}
              className="min-w-0 flex-1 rounded-md border border-border/40 bg-background/50 px-2 py-1 text-sm text-[var(--ink)] placeholder-muted-foreground/30 outline-none focus:border-primary/60"
            />
            <a
              href={
                reservationPhoneEnabled
                  ? `https://wa.me/${reservationWaDigits}?text=${encodeURIComponent(reservationMessengerPrefill)}`
                  : undefined
              }
              target={reservationPhoneEnabled ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-disabled={!reservationPhoneEnabled}
              tabIndex={reservationPhoneEnabled ? 0 : -1}
              onClick={(e) => {
                if (!reservationPhoneEnabled) e.preventDefault();
              }}
              title={tr("guest.messageOnWhatsApp")}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all ${
                reservationPhoneEnabled
                  ? "bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25"
                  : "bg-white/5 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M20.52 3.48A11.78 11.78 0 0012.05 0C5.5 0 .2 5.3.2 11.85c0 2.09.55 4.13 1.6 5.93L0 24l6.39-1.67a11.85 11.85 0 005.66 1.44h.01c6.55 0 11.85-5.3 11.85-11.85 0-3.16-1.23-6.13-3.39-8.44zM12.06 21.7h-.01a9.84 9.84 0 01-5.02-1.37l-.36-.21-3.79.99 1.01-3.69-.23-.38a9.83 9.83 0 01-1.5-5.19c0-5.44 4.42-9.86 9.87-9.86 2.63 0 5.11 1.03 6.97 2.89a9.79 9.79 0 012.89 6.97c-.01 5.45-4.43 9.85-9.83 9.85zm5.4-7.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.46a8.92 8.92 0 01-1.65-2.05c-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.91-2.18-.24-.58-.49-.5-.66-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.07 4.47.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.75-.71 2-1.4.25-.69.25-1.27.17-1.4-.07-.13-.27-.2-.57-.35z" />
              </svg>
            </a>
            <a
              href={reservationPhoneEnabled ? `https://t.me/${reservationTmePath}` : undefined}
              target={reservationPhoneEnabled ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-disabled={!reservationPhoneEnabled}
              tabIndex={reservationPhoneEnabled ? 0 : -1}
              onClick={(e) => {
                if (!reservationPhoneEnabled) e.preventDefault();
              }}
              title={tr("guest.messageOnTelegram")}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all ${
                reservationPhoneEnabled
                  ? "bg-[#229ED9]/15 text-[#229ED9] hover:bg-[#229ED9]/25"
                  : "bg-white/5 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M11.94.5C5.62.5.5 5.62.5 11.94s5.12 11.44 11.44 11.44 11.44-5.12 11.44-11.44S18.26.5 11.94.5zm5.31 7.86l-1.78 8.4c-.13.6-.49.74-.99.46l-2.74-2.02-1.32 1.27c-.15.15-.27.27-.55.27l.2-2.79 5.07-4.58c.22-.2-.05-.31-.34-.11l-6.27 3.95-2.7-.84c-.59-.18-.6-.59.12-.87l10.55-4.07c.49-.18.92.12.75.93z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Editable group name. Pre-filled with the auto-generated
            "[Platform] [dates] - [guest] - [property]" string; the host
            can overwrite it with anything (the "Copy group name" button
            copies whatever is in the field). Empty + Save resets to the
            auto name. */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={groupNameValue}
            onChange={(e) => setGroupNameOverride(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border/50 bg-background/50 px-2 py-1 text-[11px] text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:text-foreground"
          />
          {groupNameOverride !== null && (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveGroupName}
              disabled={savingGroupName}
              className="rounded-lg text-xs"
            >
              {savingGroupName ? tr("reservation.saving") : c.saveName}
            </Button>
          )}
          {groupNameOverride === null && reservation.groupName && (
            <button
              type="button"
              onClick={() => { setGroupNameOverride(""); }}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {c.resetToAuto}
            </button>
          )}
        </div>

        {!editingGroupUrls ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {reservation.tgGroupUrl && (
              <a
                href={reservation.tgGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#229ED9]/30 bg-[#229ED9]/10 px-3 py-1.5 text-xs font-medium text-[#229ED9] transition-colors hover:bg-[#229ED9]/20"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                  <path d="M11.94.5C5.62.5.5 5.62.5 11.94s5.12 11.44 11.44 11.44 11.44-5.12 11.44-11.44S18.26.5 11.94.5zm5.31 7.86l-1.78 8.4c-.13.6-.49.74-.99.46l-2.74-2.02-1.32 1.27c-.15.15-.27.27-.55.27l.2-2.79 5.07-4.58c.22-.2-.05-.31-.34-.11l-6.27 3.95-2.7-.84c-.59-.18-.6-.59.12-.87l10.55-4.07c.49-.18.92.12.75.93z" />
                </svg>
                {c.openTelegramGroup}
              </a>
            )}
            {reservation.waGroupUrl && (
              <a
                href={reservation.waGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/20"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.48A11.78 11.78 0 0012.05 0C5.5 0 .2 5.3.2 11.85c0 2.09.55 4.13 1.6 5.93L0 24l6.39-1.67a11.85 11.85 0 005.66 1.44h.01c6.55 0 11.85-5.3 11.85-11.85 0-3.16-1.23-6.13-3.39-8.44zM12.06 21.7h-.01a9.84 9.84 0 01-5.02-1.37l-.36-.21-3.79.99 1.01-3.69-.23-.38a9.83 9.83 0 01-1.5-5.19c0-5.44 4.42-9.86 9.87-9.86 2.63 0 5.11 1.03 6.97 2.89a9.79 9.79 0 012.89 6.97c-.01 5.45-4.43 9.85-9.83 9.85zm5.4-7.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.46a8.92 8.92 0 01-1.65-2.05c-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.91-2.18-.24-.58-.49-.5-.66-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.07 4.47.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.75-.71 2-1.4.25-.69.25-1.27.17-1.4-.07-.13-.27-.2-.57-.35z" />
                </svg>
                {c.openWhatsAppGroup}
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setEditTgGroupUrl(reservation.tgGroupUrl ?? "");
                setEditWaGroupUrl(reservation.waGroupUrl ?? "");
                setGroupUrlsError(null);
                setEditingGroupUrls(true);
              }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {reservation.tgGroupUrl || reservation.waGroupUrl ? c.editLinks : c.addGroupLinks}
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] font-medium text-muted-foreground">Telegram</span>
              <input
                type="url"
                value={editTgGroupUrl}
                onChange={(e) => setEditTgGroupUrl(e.target.value)}
                placeholder="https://t.me/+abcdef…"
                className="h-8 flex-1 rounded-md border border-border/50 bg-background/50 px-2 text-xs outline-none focus:border-primary/50"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] font-medium text-muted-foreground">WhatsApp</span>
              <input
                type="url"
                value={editWaGroupUrl}
                onChange={(e) => setEditWaGroupUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/…"
                className="h-8 flex-1 rounded-md border border-border/50 bg-background/50 px-2 text-xs outline-none focus:border-primary/50"
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              {c.blankRemovesLink}
            </p>
            {groupUrlsError && (
              <p className="text-[11px] text-rose-500">{groupUrlsError}</p>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveGroupUrls}
                disabled={savingGroupUrls}
                className="rounded-lg text-xs"
              >
                {savingGroupUrls ? tr("reservation.saving") : tr("common.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditingGroupUrls(false)}
                className="rounded-lg text-xs"
              >
                {tr("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
        </aside>

        {/* Main column — passport documents + guest list */}
        <div className="min-w-0 space-y-6 lg:flex-1">

      {legacyPassportOcrEnabled && <>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border/40 hover:border-primary/30 hover:bg-muted/10"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex min-h-[100px] flex-col items-center justify-center p-6">
          <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
            isDragActive ? "bg-primary/15 text-primary scale-110" : "bg-muted/40 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          }`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium">
            {isDragActive ? tr("reservation.dropHere") : tr("reservation.dropPassport")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">JPG, PNG, PDF</p>
        </div>
      </div>

      {/* Privacy assurance — backed by the impersonation masking in
          src/lib/guest-privacy.ts: an impersonating superadmin gets
          passport / ID fields redacted from every API response. */}
      <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-card/20 px-3 py-2">
        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {c.privacyNote}
        </p>
      </div>

      {/* Staged Files */}
      {files.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {files.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1 text-[11px]"
              >
                {file.name}
                <button
                  onClick={() => removeFile(index)}
                  className="ml-0.5 rounded p-0.5 hover:bg-foreground/10"
                >
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <div className="flex shrink-0 gap-2 ml-3">
            <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[11px]" onClick={() => setFiles([])}>
              {tr("reservation.clear")}
            </Button>
            <Button onClick={extractData} disabled={loading} size="sm" className="h-7 rounded-lg text-[11px]">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {tr("reservation.extracting")}
                </span>
              ) : (
                `${tr("reservation.extract")} (${files.length})`
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Extraction summary */}
      {extractionResult && extractionResult.total > 0 && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs ${
            extractionResult.successful === extractionResult.total
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
              : "border-amber-400/30 bg-amber-400/5 text-amber-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {extractionResult.successful === extractionResult.total
                ? c.extractedAll(extractionResult.successful, extractionResult.total)
                : c.extractedPartial(
                    extractionResult.successful,
                    extractionResult.total,
                    extractionResult.total - extractionResult.successful,
                  )}
            </span>
            <button
              onClick={() => setExtractionResult(null)}
              className="text-muted-foreground/40 hover:text-[var(--ink)]"
              aria-label={c.dismissSummary}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {extractionResult.files.some((f) => f.status === "failed") && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground/80">
              {extractionResult.files
                .filter((f) => f.status === "failed")
                .map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-destructive/80">✗</span>
                    <span className="font-medium">{f.name}</span>
                    {f.reason && <span className="text-muted-foreground/60">— {f.reason}</span>}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      </>}

      {/* Guests action row */}
      {(guests.length > 0 || templates.length > 0) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {templates.length > 0 && (
            <div className="relative" ref={templateMenuRef}>
              <button
                onClick={() => setTemplatePickerOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-md border border-border/30 bg-card/30 px-3 py-1.5 text-xs font-medium text-[var(--ink-3)] transition-all hover:border-border/60 hover:bg-card/60 hover:text-[var(--ink)]"
                title={c.generateMessageTitle}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.97-4.03 9-9 9-1.41 0-2.74-.32-3.92-.9L3 21l.9-5.08A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" />
                </svg>
                {c.generateMessage}
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {templatePickerOpen && (
                <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg)] shadow-lg">
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {templates.map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => pickTemplate(t)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-[var(--ink)] hover:bg-[var(--bg-2)]"
                        >
                          <span className="mt-0.5 rounded bg-[var(--line-2)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--ink-3)]">
                            {t.language}
                          </span>
                          <span className="flex-1">
                            <span className="font-medium">{t.name}</span>
                            {t.subject && (
                              <span className="block truncate text-[11px] text-[var(--ink-4)]">
                                {t.subject}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {guests.length > 0 && (
            <button
              onClick={exportGuestsCsv}
              className="flex items-center gap-1.5 rounded-md border border-border/30 bg-card/30 px-3 py-1.5 text-xs font-medium text-[var(--ink-3)] transition-all hover:border-border/60 hover:bg-card/60 hover:text-[var(--ink)]"
              title={c.exportCsvTitle}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {c.exportCsv}
            </button>
          )}
        </div>
      )}

      {/* Rendered template preview */}
      {activeTemplate && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)]">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-[var(--ink)]">{activeTemplate.name}</span>
              <span className="rounded bg-[var(--line-2)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--ink-3)]">
                {activeTemplate.language}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={copyMessage}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  copyState === "copied"
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-[var(--m-accent)] text-white hover:bg-[var(--m-accent-2)]"
                }`}
              >
                {copyState === "copied" ? tr("common.copied") : tr("common.copy")}
              </button>
              <button
                onClick={() => setActiveTemplate(null)}
                className="rounded-md p-1 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground"
                aria-label={c.closePreview}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="space-y-2 p-4 text-xs">
            {renderedSubject && (
              <div className="font-semibold text-[var(--ink)]">{renderedSubject}</div>
            )}
            <textarea
              id="rendered-message-body"
              readOnly
              value={renderedBody}
              rows={Math.min(Math.max(renderedBody.split("\n").length + 1, 4), 16)}
              className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-sans text-[var(--ink-2)] outline-none focus:border-[var(--line-2)]"
            />
          </div>
        </div>
      )}
      <GuestCards
        guests={guests}
        checkIn={reservation.checkIn}
        checkOut={reservation.checkOut}
        propertyName={propertyName}
        onDeleteGuest={onDeleteGuest}
        onUpdateParent={onUpdateParent}
        onUpdateGuest={onUpdateGuest}
      />

      {/* RT-25.2 — Pre-arrival answers panel. Renders the submitted
          GuestFormSubmission keyed by the field labels captured at
          submit time, so editing the template later does not change
          history. */}
      {guestFormSubmission?.submittedAt && guestFormSubmission.answers.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold">{c.preArrivalAnswers}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {guestFormStatusLabel()}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {guestFormSubmission.answers.map((a) => (
              <div key={a.fieldId} className="rounded-md border border-border/40 bg-background/40 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {a.label || a.fieldId}
                </dt>
                <dd className="mt-1 text-sm text-foreground break-words">
                  {renderGuestFormAnswerValue(a)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {guestFormSubmission && guestFormSubmission.travelers.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold">{c.registrationReview}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c.travelersCount(guestFormSubmission.travelerCount)} · {guestFormStatusLabel()}
          </p>
          {guestFormSubmission.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-300">
              {guestFormSubmission.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {guestFormSubmission.travelers.map((traveler) => (
              <details key={traveler.clientId} className="rounded-md border border-border/40 bg-background/40 p-3">
                <summary className="cursor-pointer list-none">
                <p className="text-sm font-medium">
                  {traveler.firstName} {traveler.lastName}{traveler.isLead ? ` · ${c.lead}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {traveler.documentType} {traveler.documentNumberMasked}
                </p>
                </summary>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{c.born}</dt><dd>{traveler.dateOfBirth}</dd>
                  <dt className="text-muted-foreground">{c.birthPlace}</dt><dd>{traveler.birthPlace}, {traveler.birthCountry}</dd>
                  <dt className="text-muted-foreground">{c.citizenship}</dt><dd>{traveler.citizenshipCountry}</dd>
                  <dt className="text-muted-foreground">{c.residence}</dt><dd>{traveler.residenceAddress}, {traveler.residencePlace}, {traveler.residenceCountry}</dd>
                  <dt className="text-muted-foreground">{c.document}</dt><dd>{traveler.documentType} {traveler.documentNumberMasked}</dd>
                  <dt className="text-muted-foreground">{c.taxSuggestion}</dt><dd>{traveler.taxCategorySuggestion ?? c.reviewRequired}</dd>
                  {traveler.borderEntryDate && <><dt className="text-muted-foreground">{c.borderEntry}</dt><dd>{traveler.borderEntryDate} · {traveler.borderEntryPlace} · {traveler.borderEntryPoint}</dd></>}
                </dl>
              </details>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {c.maskedNote}{guestFormSubmission.lastChangedAt ? c.lastChanged(new Date(guestFormSubmission.lastChangedAt).toLocaleString(c.dateLocale)) : ""}
          </p>
        </div>
      )}

      {manualEVisitorHandoff && (
        <section className="rounded-xl border border-amber-400/40 bg-amber-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{c.handoffTitle}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.handoffDesc}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setManualEVisitorHandoff(null)}
            >
              {c.close}
            </Button>
          </div>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div><dt className="text-muted-foreground">{c.stay}</dt><dd>{manualEVisitorHandoff.stay.checkIn} – {manualEVisitorHandoff.stay.checkOut}</dd></div>
            <div><dt className="text-muted-foreground">{c.arrival}</dt><dd>{manualEVisitorHandoff.stay.expectedArrivalTime}</dd></div>
            <div><dt className="text-muted-foreground">{c.guests}</dt><dd>{manualEVisitorHandoff.stay.bookedGuestCount}</dd></div>
          </dl>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {manualEVisitorHandoff.travelers.map((traveler, index) => (
              <div key={`${traveler.documentNumber}-${index}`} className="rounded-md border border-border/40 bg-background/50 p-3 text-xs">
                <p className="font-medium">{traveler.firstName} {traveler.lastName}{traveler.isLead ? ` · ${c.lead}` : ""}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                  <dt className="text-muted-foreground">{c.born}</dt><dd>{traveler.dateOfBirth}</dd>
                  <dt className="text-muted-foreground">{c.gender}</dt><dd>{traveler.gender}</dd>
                  <dt className="text-muted-foreground">{c.birthPlace}</dt><dd>{traveler.birthPlace}, {traveler.birthCountry}</dd>
                  <dt className="text-muted-foreground">{c.citizenship}</dt><dd>{traveler.citizenshipCountry}</dd>
                  <dt className="text-muted-foreground">{c.residence}</dt><dd>{traveler.residenceAddress}, {traveler.residencePlace}, {traveler.residenceCountry}</dd>
                  <dt className="text-muted-foreground">{c.document}</dt><dd className="font-mono font-semibold">{traveler.documentType} {traveler.documentNumber}</dd>
                  <dt className="text-muted-foreground">{c.taxSuggestion}</dt><dd>{traveler.taxCategorySuggestion ?? c.manualReviewRequired}</dd>
                  {traveler.borderEntryDate && <><dt className="text-muted-foreground">{c.borderEntry}</dt><dd>{traveler.borderEntryDate} · {traveler.borderEntryPlace} · {traveler.borderEntryPoint}</dd></>}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Extraction Log — below guests */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)]">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
            <span className="text-xs font-medium text-[var(--ink-3)]">
              {tr("reservation.extractionLog")}
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-[var(--ink-4)] hover:text-[var(--ink)]"
            >
              {tr("reservation.clear")}
            </button>
          </div>
          <div ref={logRef} className="overflow-y-auto p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed" style={{ maxHeight: 200 }}>
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="shrink-0 text-[var(--ink-4)]">{log.time}</span>
                <span
                  className={
                    log.type === "success"
                      ? "text-emerald-500"
                      : log.type === "error"
                      ? "text-rose-500"
                      : log.type === "processing"
                      ? "text-amber-400"
                      : "text-[var(--ink-3)]"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
    </div>
  );
}
