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

export function validateMobilePropertySettings(
  input: MobilePropertySettingsInput,
): MobilePropertySettingsResult {
  const nights = Number(input.minNights.trim());
  if (!Number.isInteger(nights) || nights < 1 || nights > 30) {
    return { ok: false, error: "Mindestnächte: eine ganze Zahl zwischen 1 und 30." };
  }
  const checkInTime = input.checkInTime.trim();
  const checkOutTime = input.checkOutTime.trim();
  if (!TIME.test(checkInTime)) {
    return { ok: false, error: "Check-in-Zeit bitte als Uhrzeit angeben, zum Beispiel 14:00." };
  }
  if (!TIME.test(checkOutTime)) {
    return { ok: false, error: "Check-out-Zeit bitte als Uhrzeit angeben, zum Beispiel 10:00." };
  }
  // Deliberately no "check-out before check-in" rule: nothing else in
  // the app has one, and a flat with check-in at 00:00 would become
  // unsavable from the phone alone.
  return { ok: true, patch: { minNights: nights, checkInTime, checkOutTime } };
}
