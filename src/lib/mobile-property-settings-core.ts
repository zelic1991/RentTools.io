import { resolveCopy, type CopyMap, type Locale } from "@/lib/i18n/translations";

/**
 * The three settings a host actually changes from the apartment: how
 * many nights are the minimum, and when the day starts and ends. The
 * property API assigns what it is given, so the guard rails live here —
 * and here they can be tested without a browser.
 */

export interface MobilePropertySettingsInput {
  minNights: string;
  checkInTime: string;
  checkOutTime: string;
}

export interface MobilePropertySettingsPatch {
  minNights: number;
  checkInTime: string;
  checkOutTime: string;
}

export type MobilePropertySettingsResult =
  | { ok: true; patch: MobilePropertySettingsPatch }
  | { ok: false; error: string };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const ERRORS: CopyMap<{ minNights: string; checkIn: string; checkOut: string }> = {
  en: {
    minNights: "Minimum nights: a whole number from 1 to 30.",
    checkIn: "Please enter the check-in time as a time, for example 14:00.",
    checkOut: "Please enter the check-out time as a time, for example 10:00.",
  },
  ru: {
    minNights: "Минимум ночей: целое число от 1 до 30.",
    checkIn: "Укажите время заезда, например 14:00.",
    checkOut: "Укажите время выезда, например 10:00.",
  },
  de: {
    minNights: "Mindestnächte: eine ganze Zahl zwischen 1 und 30.",
    checkIn: "Check-in-Zeit bitte als Uhrzeit angeben, zum Beispiel 14:00.",
    checkOut: "Check-out-Zeit bitte als Uhrzeit angeben, zum Beispiel 10:00.",
  },
  fr: {
    minNights: "Nuits minimum : un nombre entier entre 1 et 30.",
    checkIn: "Indiquez l’heure d’arrivée sous forme d’heure, par exemple 14:00.",
    checkOut: "Indiquez l’heure de départ sous forme d’heure, par exemple 10:00.",
  },
  es: {
    minNights: "Noches mínimas: un número entero entre 1 y 30.",
    checkIn: "Indica la hora de entrada como hora, por ejemplo 14:00.",
    checkOut: "Indica la hora de salida como hora, por ejemplo 10:00.",
  },
  hr: {
    minNights: "Minimalan broj noćenja: cijeli broj od 1 do 30.",
    checkIn: "Unesite vrijeme dolaska kao sat, na primjer 14:00.",
    checkOut: "Unesite vrijeme odlaska kao sat, na primjer 10:00.",
  },
};

export function validateMobilePropertySettings(
  input: MobilePropertySettingsInput,
  locale: Locale = "de",
): MobilePropertySettingsResult {
  const errors = resolveCopy(ERRORS, locale);
  const nights = Number(input.minNights.trim());
  if (!Number.isInteger(nights) || nights < 1 || nights > 30) {
    return { ok: false, error: errors.minNights };
  }
  const checkInTime = input.checkInTime.trim();
  const checkOutTime = input.checkOutTime.trim();
  if (!TIME.test(checkInTime)) {
    return { ok: false, error: errors.checkIn };
  }
  if (!TIME.test(checkOutTime)) {
    return { ok: false, error: errors.checkOut };
  }
  // Deliberately no "check-out before check-in" rule: nothing else in
  // the app has one, and a flat with check-in at 00:00 would become
  // unsavable from the phone alone.
  return { ok: true, patch: { minNights: nights, checkInTime, checkOutTime } };
}
