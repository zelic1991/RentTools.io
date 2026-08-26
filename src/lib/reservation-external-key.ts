export interface DirectReservationExternalKeyInput {
  propertyId: number;
  checkIn: string;
  checkOut: string;
  ownerSource: {
    kind: "owner-chat";
    recordedOn: string;
    sequence: number;
  };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIRECT_KEY =
  /^DIRECT:v1:p([1-9]\d*):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2}):owner-chat:(\d{4}-\d{2}-\d{2}):(\d{3})$/;
const INPUT_KEYS = new Set(["propertyId", "checkIn", "checkOut", "ownerSource"]);
const SOURCE_KEYS = new Set(["kind", "recordedOn", "sequence"]);

function calendarDay(value: string, field: string): number {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error(`${field} must be YYYY-MM-DD`);
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a real calendar day`);
  }
  return Math.floor(timestamp / 86_400_000);
}

function rejectUnknownKeys(value: object, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${label} contains forbidden fields: ${unknown.join(", ")}`);
  }
}

/**
 * Stable, PII-free identity for a direct reservation migration.
 *
 * Contract:
 * DIRECT:v1:p<propertyId>:<checkIn>:<checkOut>:owner-chat:<recordedOn>:<sequence>
 *
 * `recordedOn` and `sequence` identify the canonical Owner source record; the
 * function accepts no guest name, email or phone field. Re-running it with the
 * same property, checkout-exclusive stay and source reference returns exactly
 * the same key.
 */
export function buildDirectReservationExternalKey(
  input: DirectReservationExternalKeyInput,
): string {
  rejectUnknownKeys(input, INPUT_KEYS, "Direct key input");
  rejectUnknownKeys(input.ownerSource, SOURCE_KEYS, "Direct key ownerSource");
  if (!Number.isInteger(input.propertyId) || input.propertyId <= 0) {
    throw new Error("propertyId must be a positive integer");
  }
  if (input.ownerSource.kind !== "owner-chat") {
    throw new Error("ownerSource.kind must be owner-chat");
  }
  const start = calendarDay(input.checkIn, "checkIn");
  const end = calendarDay(input.checkOut, "checkOut");
  calendarDay(input.ownerSource.recordedOn, "ownerSource.recordedOn");
  if (end <= start) throw new Error("checkOut must be after checkIn (checkout-exclusive)");
  if (
    !Number.isInteger(input.ownerSource.sequence) ||
    input.ownerSource.sequence < 1 ||
    input.ownerSource.sequence > 999
  ) {
    throw new Error("ownerSource.sequence must be an integer from 1 to 999");
  }

  return [
    "DIRECT",
    "v1",
    `p${input.propertyId}`,
    input.checkIn,
    input.checkOut,
    "owner-chat",
    input.ownerSource.recordedOn,
    String(input.ownerSource.sequence).padStart(3, "0"),
  ].join(":");
}

export function assertDirectReservationExternalKeyBinding(
  key: string,
  binding: Pick<DirectReservationExternalKeyInput, "propertyId" | "checkIn" | "checkOut">,
): void {
  const match = DIRECT_KEY.exec(key);
  if (!match) throw new Error("Direct externalKey does not follow the PII-free v1 contract");
  const [, propertyId, checkIn, checkOut, recordedOn, sequence] = match;
  calendarDay(checkIn, "externalKey.checkIn");
  calendarDay(checkOut, "externalKey.checkOut");
  calendarDay(recordedOn, "externalKey.ownerSource.recordedOn");
  if (Number(sequence) < 1) throw new Error("Direct externalKey source sequence must be 001-999");
  if (
    Number(propertyId) !== binding.propertyId ||
    checkIn !== binding.checkIn ||
    checkOut !== binding.checkOut
  ) {
    throw new Error("Direct externalKey does not match its property and checkout-exclusive stay");
  }
}
