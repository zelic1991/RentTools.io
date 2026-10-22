import { resolveCopy, type CopyMap, type Locale } from "@/lib/i18n/translations";

/**
 * The API answers in English because it is also a machine interface. The
 * phone screens follow the user's language, and "Overlapping reservation
 * exists" in the middle of a German or Croatian screen reads like a crash
 * rather than an answer.
 *
 * Only messages that can actually reach a mobile screen are translated;
 * anything else is passed through unchanged, because a strange English
 * sentence is still better than a wrong translated one.
 */

const MESSAGES: Record<string, CopyMap<string>> = {
  "Overlapping reservation exists": {
    en: "These days are already taken by another booking.",
    ru: "Эти дни уже заняты другим бронированием.",
    de: "Diese Tage sind schon durch eine andere Buchung belegt.",
    fr: "Ces jours sont déjà pris par une autre réservation.",
    es: "Estos días ya están ocupados por otra reserva.",
    hr: "Ti su dani već zauzeti drugom rezervacijom.",
  },
  "Overlapping booking from another platform": {
    en: "These days are taken through another platform.",
    ru: "Эти дни заняты через другую платформу.",
    de: "Diese Tage sind über eine andere Plattform belegt.",
    fr: "Ces jours sont pris via une autre plateforme.",
    es: "Estos días están ocupados a través de otra plataforma.",
    hr: "Ti su dani zauzeti preko druge platforme.",
  },
  "Reservation dates are outside the owner calendar window": {
    en: "These days are outside the booking window.",
    ru: "Эти дни находятся за пределами окна бронирования.",
    de: "Diese Tage liegen außerhalb des Buchungsfensters.",
    fr: "Ces jours sont en dehors de la fenêtre de réservation.",
    es: "Estos días están fuera del periodo de reservas.",
    hr: "Ti su dani izvan razdoblja za rezervacije.",
  },
  "checkOut must be after checkIn": {
    en: "Check-out must be after check-in.",
    ru: "Дата выезда должна быть позже даты заезда.",
    de: "Die Abreise muss nach der Anreise liegen.",
    fr: "Le départ doit être postérieur à l’arrivée.",
    es: "La salida debe ser posterior a la llegada.",
    hr: "Odlazak mora biti nakon dolaska.",
  },
  "Invalid checkIn date": {
    en: "The check-in date is invalid.",
    ru: "Дата заезда недействительна.",
    de: "Das Anreisedatum ist ungültig.",
    fr: "La date d’arrivée n’est pas valide.",
    es: "La fecha de llegada no es válida.",
    hr: "Datum dolaska nije valjan.",
  },
  "Invalid checkOut date": {
    en: "The check-out date is invalid.",
    ru: "Дата выезда недействительна.",
    de: "Das Abreisedatum ist ungültig.",
    fr: "La date de départ n’est pas valide.",
    es: "La fecha de salida no es válida.",
    hr: "Datum odlaska nije valjan.",
  },
  "Invalid reservation data": {
    en: "The details are incomplete or invalid.",
    ru: "Данные неполные или недействительные.",
    de: "Die Eingaben sind unvollständig oder ungültig.",
    fr: "Les informations sont incomplètes ou non valides.",
    es: "Los datos están incompletos o no son válidos.",
    hr: "Podaci su nepotpuni ili nisu valjani.",
  },
  "bookedGuestCount must be an integer from 1 to 50": {
    en: "The number of guests must be a whole number from 1 to 50.",
    ru: "Количество гостей должно быть целым числом от 1 до 50.",
    de: "Gästezahl muss eine ganze Zahl zwischen 1 und 50 sein.",
    fr: "Le nombre de voyageurs doit être un nombre entier entre 1 et 50.",
    es: "El número de huéspedes debe ser un número entero entre 1 y 50.",
    hr: "Broj gostiju mora biti cijeli broj od 1 do 50.",
  },
  "grossAmountCents must be a nonnegative integer or null": {
    en: "The amount is invalid.",
    ru: "Сумма недействительна.",
    de: "Der Betrag ist ungültig.",
    fr: "Le montant n’est pas valide.",
    es: "El importe no es válido.",
    hr: "Iznos nije valjan.",
  },
  "currency must be a supported ISO 4217 code": {
    en: "This currency is not supported.",
    ru: "Эта валюта не поддерживается.",
    de: "Die Währung wird nicht unterstützt.",
    fr: "Cette devise n’est pas prise en charge.",
    es: "Esta moneda no es compatible.",
    hr: "Ta valuta nije podržana.",
  },
  "Set the confirmed traveler count before generating the guest link": {
    en: "Please enter the confirmed number of travelers first.",
    ru: "Сначала укажите подтверждённое количество гостей.",
    de: "Bitte zuerst die bestätigte Gästezahl eintragen.",
    fr: "Indiquez d’abord le nombre de voyageurs confirmé.",
    es: "Primero indica el número confirmado de viajeros.",
    hr: "Najprije unesite potvrđeni broj putnika.",
  },
  "No guest-form template configured for this property": {
    en: "No pre-arrival form is set up for this property.",
    ru: "Для этого объекта не настроена анкета перед заездом.",
    de: "Für diese Unterkunft ist kein Anreiseformular eingerichtet.",
    fr: "Aucun formulaire de pré-arrivée n’est configuré pour ce logement.",
    es: "No hay ningún formulario previo a la llegada configurado para este alojamiento.",
    hr: "Za ovaj smještaj nije postavljen obrazac prije dolaska.",
  },
  "Protect the property's public calendar feeds before collecting identity data": {
    en: "The calendar feeds must be protected before guest data is collected.",
    ru: "Перед сбором данных гостей нужно защитить календарные фиды.",
    de: "Die Kalender-Feeds müssen geschützt sein, bevor Gastdaten erfasst werden.",
    fr: "Les flux de calendrier doivent être protégés avant de collecter les données des voyageurs.",
    es: "Los feeds de calendario deben estar protegidos antes de recopilar datos de huéspedes.",
    hr: "Feedovi kalendara moraju biti zaštićeni prije prikupljanja podataka gostiju.",
  },
  "Secure guest-data storage is not configured": {
    en: "Encrypted storage for guest data is not set up.",
    ru: "Зашифрованное хранилище данных гостей не настроено.",
    de: "Die verschlüsselte Ablage für Gastdaten ist nicht eingerichtet.",
    fr: "Le stockage chiffré des données des voyageurs n’est pas configuré.",
    es: "El almacenamiento cifrado de datos de huéspedes no está configurado.",
    hr: "Šifrirana pohrana podataka gostiju nije postavljena.",
  },
  "Impersonation is read-only": {
    en: "This session is read-only.",
    ru: "Этот сеанс доступен только для чтения.",
    de: "Diese Sitzung ist schreibgeschützt.",
    fr: "Cette session est en lecture seule.",
    es: "Esta sesión es de solo lectura.",
    hr: "Ova sesija je samo za čitanje.",
  },
  "Unauthorized": {
    en: "Not signed in. Please sign in again.",
    ru: "Вы не вошли в систему. Пожалуйста, войдите снова.",
    de: "Nicht angemeldet. Bitte neu anmelden.",
    fr: "Non connecté. Veuillez vous reconnecter.",
    es: "No has iniciado sesión. Vuelve a iniciar sesión.",
    hr: "Niste prijavljeni. Prijavite se ponovno.",
  },
  "Not found": {
    en: "Not found, or you don't have permission for it.",
    ru: "Не найдено или нет доступа.",
    de: "Nicht gefunden oder keine Berechtigung dafür.",
    fr: "Introuvable, ou vous n’avez pas l’autorisation.",
    es: "No encontrado o sin permiso para ello.",
    hr: "Nije pronađeno ili za to nemate dopuštenje.",
  },
  "Internal server error": {
    en: "Server error. Please try again later.",
    ru: "Ошибка сервера. Попробуйте позже.",
    de: "Serverfehler. Bitte später noch einmal versuchen.",
    fr: "Erreur du serveur. Veuillez réessayer plus tard.",
    es: "Error del servidor. Inténtalo de nuevo más tarde.",
    hr: "Pogreška poslužitelja. Pokušajte ponovno kasnije.",
  },
};

export function localizedApiError(message: unknown, locale: Locale, fallback: string): string {
  if (typeof message !== "string" || message.trim() === "") return fallback;
  const entry = Object.prototype.hasOwnProperty.call(MESSAGES, message) ? MESSAGES[message] : undefined;
  return entry ? resolveCopy(entry, locale) : message;
}

/** German wording, as the phone screens showed before they followed the locale. */
export function germanApiError(message: unknown, fallback: string): string {
  return localizedApiError(message, "de", fallback);
}
