import type { Prisma, PrismaClient, Reservation } from "@/generated/prisma/client";
import { normalizePlatformSlug } from "@/lib/platforms";

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
const MAX_EXTERNAL_KEY_LENGTH = 512;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  "air-bnb": "airbnb",
  "booking-com": "booking",
  bookingcom: "booking",
  "direct-sales": "direct",
  manual: "direct",
};

/** Canonical namespace used by the Reservation unique identity. */
export function canonicalizeReservationPlatform(value: string): string {
  const slug = normalizePlatformSlug(value);
  if (!slug) throw new Error("platform must contain a valid platform name");
  return PLATFORM_ALIASES[slug] ?? slug;
}

/** Empty is represented by NULL; non-empty keys are trimmed and bounded. */
export function normalizeReservationExternalKey(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const key = value.trim();
  if (!key) throw new Error("externalKey must not be empty");
  if (key.length > MAX_EXTERNAL_KEY_LENGTH || CONTROL_CHARACTERS.test(key)) {
    throw new Error("externalKey is invalid");
  }
  return key;
}

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

export interface ReservationExternalKeyBinding {
  propertyId: number;
  platform: string;
  checkIn: string;
  checkOut: string;
  externalKey: string;
}

/**
 * Explicit external-key contract.
 *
 * DIRECT:v1 keys bind property + checkout-exclusive dates and may only live in
 * the `direct` platform namespace. Other platform keys are opaque: they bind
 * only the unique (property, canonical platform, externalKey) identity. We do
 * not infer date semantics from an unknown provider format.
 */
export function assertReservationExternalKeyBinding(
  binding: ReservationExternalKeyBinding,
): void {
  const platform = canonicalizeReservationPlatform(binding.platform);
  const externalKey = normalizeReservationExternalKey(binding.externalKey);
  if (!externalKey) throw new Error("externalKey must not be empty");

  if (externalKey.startsWith("DIRECT:")) {
    if (!externalKey.startsWith("DIRECT:v1:")) {
      throw new Error("Unsupported Direct externalKey contract");
    }
    if (platform !== "direct") {
      throw new Error("Direct externalKey must use the direct platform");
    }
    assertDirectReservationExternalKeyBinding(externalKey, binding);
  }
}

export function assertReservationExternalKeyMutation(input: {
  externalKey: string;
  propertyId: number;
  currentPlatform: string;
  nextPlatform: string;
  nextCheckIn: string;
  nextCheckOut: string;
}): void {
  const current = canonicalizeReservationPlatform(input.currentPlatform);
  const next = canonicalizeReservationPlatform(input.nextPlatform);
  if (current !== next) {
    throw new Error("Reservation platform is bound by externalKey and cannot be changed");
  }
  assertReservationExternalKeyBinding({
    externalKey: input.externalKey,
    propertyId: input.propertyId,
    platform: next,
    checkIn: input.nextCheckIn,
    checkOut: input.nextCheckOut,
  });
}

export class ExternalReservationConflictError extends Error {
  constructor(message = "externalKey is already bound to a different reservation payload") {
    super(message);
    this.name = "ExternalReservationConflictError";
  }
}

type ExternalCreateData = Prisma.ReservationUncheckedCreateInput & {
  propertyId: number;
  platform: string;
  externalKey: string;
};

function dateOnly(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

function canonicalExternalCreateData(data: ExternalCreateData): ExternalCreateData {
  const platform = canonicalizeReservationPlatform(data.platform);
  const externalKey = normalizeReservationExternalKey(data.externalKey);
  if (!externalKey) throw new Error("externalKey must not be empty");
  assertReservationExternalKeyBinding({
    propertyId: data.propertyId,
    platform,
    checkIn: dateOnly(data.checkIn),
    checkOut: dateOnly(data.checkOut),
    externalKey,
  });
  return { ...data, platform, externalKey };
}

function nullable(value: string | null | undefined): string | null {
  return value ?? null;
}

function assertSameExternalReservation(
  existing: Reservation,
  expected: ExternalCreateData,
): void {
  if (
    existing.propertyId !== expected.propertyId ||
    canonicalizeReservationPlatform(existing.platform) !== expected.platform ||
    existing.externalKey !== expected.externalKey ||
    dateOnly(existing.checkIn) !== dateOnly(expected.checkIn) ||
    dateOnly(existing.checkOut) !== dateOnly(expected.checkOut) ||
    nullable(existing.linkedEventUid) !== nullable(expected.linkedEventUid) ||
    nullable(existing.linkedEventPlatform) !== nullable(expected.linkedEventPlatform) ||
    nullable(existing.linkedEventRole) !== nullable(expected.linkedEventRole)
  ) {
    throw new ExternalReservationConflictError();
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function findByExternalIdentity(
  db: PrismaClient,
  data: ExternalCreateData,
): Promise<Reservation | null> {
  return db.reservation.findFirst({
    where: {
      propertyId: data.propertyId,
      platform: data.platform,
      externalKey: data.externalKey,
    },
  });
}

/** Preflight is for friendly retries; the unique-index catch below is authoritative. */
export async function findIdempotentExternalReservation(
  db: PrismaClient,
  data: ExternalCreateData,
): Promise<Reservation | null> {
  const canonical = canonicalExternalCreateData(data);
  const existing = await findByExternalIdentity(db, canonical);
  if (existing) assertSameExternalReservation(existing, canonical);
  return existing;
}

/**
 * Atomically closes the concurrent-create race with the DB unique index.
 * A P2002 is idempotent only when the winning row has the same immutable stay
 * and linked-event identity; otherwise it is a real conflict.
 */
export async function createExternalReservationIdempotently(
  db: PrismaClient,
  data: ExternalCreateData,
): Promise<{ reservation: Reservation; created: boolean }> {
  const canonical = canonicalExternalCreateData(data);
  try {
    return { reservation: await db.reservation.create({ data: canonical }), created: true };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await findByExternalIdentity(db, canonical);
    if (!existing) throw error;
    assertSameExternalReservation(existing, canonical);
    return { reservation: existing, created: false };
  }
}
