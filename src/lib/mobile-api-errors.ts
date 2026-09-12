/**
 * The API answers in English because it is also a machine interface. The
 * phone screens are German throughout, and "Overlapping reservation
 * exists" in the middle of them reads like a crash rather than an answer.
 *
 * Only messages that can actually reach a mobile screen are translated;
 * anything else is passed through unchanged, because a strange English
 * sentence is still better than a wrong German one.
 */

const GERMAN: Record<string, string> = {
  "Overlapping reservation exists":
    "Diese Tage sind schon durch eine andere Buchung belegt.",
  "Overlapping booking from another platform":
    "Diese Tage sind über eine andere Plattform belegt.",
  "Reservation dates are outside the owner calendar window":
    "Diese Tage liegen außerhalb des Buchungsfensters.",
  "checkOut must be after checkIn": "Die Abreise muss nach der Anreise liegen.",
  "Invalid checkIn date": "Das Anreisedatum ist ungültig.",
  "Invalid checkOut date": "Das Abreisedatum ist ungültig.",
  "Invalid reservation data": "Die Eingaben sind unvollständig oder ungültig.",
  "bookedGuestCount must be an integer from 1 to 50":
    "Gästezahl muss eine ganze Zahl zwischen 1 und 50 sein.",
  "grossAmountCents must be a nonnegative integer or null":
    "Der Betrag ist ungültig.",
  "currency must be a supported ISO 4217 code": "Die Währung wird nicht unterstützt.",
  "Set the confirmed traveler count before generating the guest link":
    "Bitte zuerst die bestätigte Gästezahl eintragen.",
  "No guest-form template configured for this property":
    "Für diese Unterkunft ist kein Anreiseformular eingerichtet.",
  "Protect the property's public calendar feeds before collecting identity data":
    "Die Kalender-Feeds müssen geschützt sein, bevor Gastdaten erfasst werden.",
  "Secure guest-data storage is not configured":
    "Die verschlüsselte Ablage für Gastdaten ist nicht eingerichtet.",
  "Impersonation is read-only": "Diese Sitzung ist schreibgeschützt.",
  "Unauthorized": "Nicht angemeldet. Bitte neu anmelden.",
  "Not found": "Nicht gefunden oder keine Berechtigung dafür.",
  "Internal server error": "Serverfehler. Bitte später noch einmal versuchen.",
};

export function germanApiError(message: unknown, fallback: string): string {
  if (typeof message !== "string" || message.trim() === "") return fallback;
  return GERMAN[message] ?? message;
}
