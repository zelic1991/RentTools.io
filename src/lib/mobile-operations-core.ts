import type { PrecheckinStatus } from "@/lib/precheckin";

export type MobileSection = "start" | "calendar" | "guests" | "portals";
export type MobileAccessLevel = "owner" | "manager" | "cleaner";

export const MOBILE_SECTIONS: readonly MobileSection[] = [
  "start",
  "calendar",
  "guests",
  "portals",
];

export interface MobileReservationInput {
  id: number;
  checkIn: string;
  checkOut: string;
  platform: string;
  bookedGuestCount: number | null;
  persistedGuestCount: number;
  submissions: Array<{
    status: string;
    createdAt: string;
  }>;
  eVisitorReceipts: Array<{
    environment: string;
    status: string;
    readbackConfirmedAt: string | null;
    attemptedAt: string;
  }>;
}

export interface MobileGuestState {
  status: PrecheckinStatus;
  complete: boolean;
  ownerReviewRequired: boolean;
  missingFields: string[];
  eVisitorStatus:
    | "NOT_READY"
    | "READY_NOT_SUBMITTED"
    | "PRODUCTION_PENDING"
    | "READBACK_CONFIRMED"
    | "PRODUCTION_ERROR";
}

export interface MobilePortalCard {
  id: "airbnb" | "booking" | "ubytovani" | "laganini" | "website" | "renttools";
  name: string;
  connected: boolean | null;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  hasError: boolean;
  message: string;
  upcomingEvents: number;
  lastKnownOccupancyEnd: string | null;
}

const KNOWN_PRECHECKIN_STATUSES = new Set<PrecheckinStatus>([
  "NOT_INVITED",
  "INVITED",
  "IN_PROGRESS",
  "COMPLETE",
  "OWNER_REVIEW_REQUIRED",
  "OWNER_APPROVED",
  "REVOKED",
]);

function normalizePrecheckinStatus(value: string | undefined): PrecheckinStatus {
  return KNOWN_PRECHECKIN_STATUSES.has(value as PrecheckinStatus)
    ? (value as PrecheckinStatus)
    : "NOT_INVITED";
}

export function latestSubmissionStatus(
  submissions: MobileReservationInput["submissions"],
): PrecheckinStatus {
  const latest = [...submissions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  return normalizePrecheckinStatus(latest?.status);
}

export function deriveMobileGuestState(
  reservation: MobileReservationInput,
): MobileGuestState {
  const status = latestSubmissionStatus(reservation.submissions);
  const complete = status === "COMPLETE" || status === "OWNER_REVIEW_REQUIRED" || status === "OWNER_APPROVED";
  const ownerReviewRequired = status === "OWNER_REVIEW_REQUIRED" || status === "COMPLETE";
  const missingFields: string[] = [];

  if (status === "NOT_INVITED") missingFields.push("Gästeformular noch nicht erstellt");
  if (status === "INVITED") missingFields.push("Antwort der Gäste fehlt");
  if (status === "IN_PROGRESS") missingFields.push("Gästedaten noch unvollständig");
  if (status === "REVOKED") missingFields.push("Gastlink wurde widerrufen");

  const productionReceipts = reservation.eVisitorReceipts
    .filter((receipt) => receipt.environment === "production")
    .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
  const hasReadback = productionReceipts.some((receipt) => Boolean(receipt.readbackConfirmedAt));
  const latestProductionReceipt = productionReceipts[0];

  let eVisitorStatus: MobileGuestState["eVisitorStatus"] = "NOT_READY";
  if (hasReadback) {
    eVisitorStatus = "READBACK_CONFIRMED";
  } else if (latestProductionReceipt) {
    eVisitorStatus = /error|fail/i.test(latestProductionReceipt.status)
      ? "PRODUCTION_ERROR"
      : "PRODUCTION_PENDING";
  } else if (status === "OWNER_APPROVED") {
    eVisitorStatus = "READY_NOT_SUBMITTED";
  }

  return {
    status,
    complete,
    ownerReviewRequired,
    missingFields,
    eVisitorStatus,
  };
}

export function reservationGuestCount(reservation: MobileReservationInput): number | null {
  if (reservation.bookedGuestCount && reservation.bookedGuestCount > 0) {
    return reservation.bookedGuestCount;
  }
  return reservation.persistedGuestCount > 0 ? reservation.persistedGuestCount : null;
}

export function summarizeToday(
  reservations: MobileReservationInput[],
  today: string,
): {
  arrivals: MobileReservationInput[];
  departures: MobileReservationInput[];
  occupied: MobileReservationInput[];
  next: MobileReservationInput | null;
} {
  const ordered = [...reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return {
    arrivals: ordered.filter((reservation) => reservation.checkIn === today),
    departures: ordered.filter((reservation) => reservation.checkOut === today),
    occupied: ordered.filter(
      (reservation) => reservation.checkIn <= today && reservation.checkOut > today,
    ),
    next: ordered.find((reservation) => reservation.checkIn > today) ?? null,
  };
}

export function canAccessMobileSection(
  access: MobileAccessLevel,
  section: MobileSection,
): boolean {
  if (access === "owner") return true;
  if (access === "manager") return section !== "portals";
  return false;
}

export function mobileAvailabilityOverrides(
  overrides: Array<{ date: string; type: "open" | "closed" | "cleaning" }>,
): Array<{ date: string; type: "open" | "closed" }> {
  return overrides.flatMap((override) =>
    override.type === "cleaning"
      ? []
      : [{ date: override.date, type: override.type }],
  );
}

export function safePlatformLabel(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === "airbnb") return "Airbnb";
  if (normalized === "booking") return "Booking.com";
  if (normalized === "direct") return "Direkt";
  if (normalized.includes("laganini")) return "Laganini";
  if (normalized.includes("ubyt") || normalized.includes("reklama")) return "REKLAMA/Ubytování";
  return platform.trim() || "Sonstige";
}

export function redactedPlatformLabel(platform: string): string {
  const safe = safePlatformLabel(platform);
  return safe === platform.trim() ? "Sonstige" : safe;
}

function portalAliases(id: MobilePortalCard["id"]): string[] {
  if (id === "airbnb") return ["airbnb"];
  if (id === "booking") return ["booking", "booking-com"];
  if (id === "ubytovani") return ["ubytovani", "ubytování", "reklama", "reklama-hr"];
  if (id === "laganini") return ["laganini"];
  return [];
}

function matchesPortal(platform: string, id: MobilePortalCard["id"]): boolean {
  const normalized = platform.trim().toLowerCase();
  return portalAliases(id).some((alias) => normalized.includes(alias));
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildMobilePortalCards(options: {
  links: Array<{
    platform: string;
    lastFetchedAt: Date | null;
    lastError: string | null;
  }>;
  events: Array<{ platform: string; startDate: string; endDate: string }>;
  reservations: Array<{ platform: string; checkIn: Date; checkOut: Date }>;
  today: string;
  feedSlug: string | null;
  feedToken: string | null;
}): MobilePortalCard[] {
  const portalDefs: Array<[MobilePortalCard["id"], string]> = [
    ["airbnb", "Airbnb"],
    ["booking", "Booking.com"],
    ["ubytovani", "REKLAMA/Ubytování"],
    ["laganini", "Laganini"],
  ];
  const cards = portalDefs.map(([id, name]): MobilePortalCard => {
    const matchingLinks = options.links.filter((candidate) => matchesPortal(candidate.platform, id));
    const portalEvents = options.events.filter((event) => matchesPortal(event.platform, id));
    const manualReservations = options.reservations.filter((reservation) =>
      matchesPortal(reservation.platform, id),
    );
    const endDates = [
      ...portalEvents.map((event) => event.endDate),
      ...manualReservations.map((reservation) => dateOnly(reservation.checkOut)),
    ].sort();
    const upcomingIdentities = new Set([
      ...portalEvents
        .filter((event) => event.endDate > options.today)
        .map((event) => `${event.startDate}|${event.endDate}`),
      ...manualReservations
        .filter((reservation) => dateOnly(reservation.checkOut) > options.today)
        .map((reservation) => `${dateOnly(reservation.checkIn)}|${dateOnly(reservation.checkOut)}`),
    ]);
    const lastAttempt = matchingLinks
      .map((link) => link.lastFetchedAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const lastSuccess = matchingLinks
      .filter((link) => !link.lastError && link.lastFetchedAt)
      .map((link) => link.lastFetchedAt as Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const hasError = matchingLinks.some((link) => Boolean(link.lastError));
    return {
      id,
      name,
      connected: matchingLinks.length > 0,
      lastSuccessfulSyncAt: lastSuccess?.toISOString() ?? null,
      lastAttemptAt: lastAttempt?.toISOString() ?? null,
      hasError,
      message: matchingLinks.length > 0
        ? hasError
          ? `${name}-Kalender konnte zuletzt nicht aktualisiert werden.`
          : "Kalenderverbindung ist aktiv."
        : "Kein Import in RentTools nachweisbar; ein möglicher Ausgangsfeed wird hier nicht verifiziert.",
      upcomingEvents: upcomingIdentities.size,
      lastKnownOccupancyEnd: endDates.at(-1) ?? null,
    };
  });

  const directReservations = options.reservations.filter(
    (reservation) => reservation.platform.toLowerCase() === "direct",
  );
  cards.push({
    id: "website",
    name: "Direktwebsite",
    connected: null,
    lastSuccessfulSyncAt: null,
    lastAttemptAt: null,
    hasError: false,
    message: "Kein eigener Website-Connector in RentTools nachweisbar; Direktbuchungen werden im Master geführt.",
    upcomingEvents: directReservations.filter(
      (reservation) => dateOnly(reservation.checkOut) > options.today,
    ).length,
    lastKnownOccupancyEnd:
      directReservations.map((reservation) => dateOnly(reservation.checkOut)).sort().at(-1) ?? null,
  });
  cards.push({
    id: "renttools",
    name: "RentTools Feed",
    connected: Boolean(options.feedSlug),
    lastSuccessfulSyncAt: null,
    lastAttemptAt: null,
    hasError: !options.feedSlug,
    message: options.feedSlug
      ? options.feedToken
        ? "Ausgangsfeed ist eingerichtet und mit Token geschützt."
        : "Ausgangsfeed ist eingerichtet, aber nicht mit Token geschützt."
      : "Kein dauerhafter Ausgangsfeed eingerichtet.",
    upcomingEvents: options.events.filter((event) => event.endDate > options.today).length
      + options.reservations.filter((reservation) => dateOnly(reservation.checkOut) > options.today).length,
    lastKnownOccupancyEnd: [
      ...options.events.map((event) => event.endDate),
      ...options.reservations.map((reservation) => dateOnly(reservation.checkOut)),
    ].sort().at(-1) ?? null,
  });
  return cards;
}
