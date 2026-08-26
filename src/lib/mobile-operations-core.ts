import {
  normalizePrecheckinStatus,
  type PrecheckinStatus,
} from "@/lib/precheckin";

export type MobileSection = "start" | "calendar" | "guests" | "portals" | "cleaning";
export type MobileAccessLevel = "owner" | "manager" | "cleaner";

export const MOBILE_SECTIONS: readonly MobileSection[] = [
  "start",
  "calendar",
  "guests",
  "portals",
  "cleaning",
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
  status: PrecheckinStatus | "INVALID";
  complete: boolean;
  ownerReviewRequired: boolean;
  missingFields: string[];
  eVisitorStatus:
    | "NOT_READY"
    | "APPROVED_NOT_READY"
    | "READY_NOT_SUBMITTED"
    | "MANUAL_CONFIRMED"
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

export function latestSubmissionStatus(
  submissions: MobileReservationInput["submissions"],
): PrecheckinStatus | "INVALID" {
  const latest = [...submissions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  if (!latest) return "PENDING";
  return normalizePrecheckinStatus(latest.status) ?? "INVALID";
}

export function deriveMobileGuestState(
  reservation: MobileReservationInput,
): MobileGuestState {
  const status = latestSubmissionStatus(reservation.submissions);
  const complete =
    status === "GUEST_COMPLETE" ||
    status === "OWNER_REVIEW" ||
    status === "OWNER_APPROVED" ||
    status === "EVISITOR_READY" ||
    status === "EVISITOR_CONFIRMED_MANUAL";
  const ownerReviewRequired = status === "GUEST_COMPLETE" || status === "OWNER_REVIEW";
  const missingFields: string[] = [];

  if (reservation.submissions.length === 0) {
    missingFields.push("Gästeformular noch nicht erstellt");
  } else if (status === "PENDING") {
    missingFields.push("Gästedaten noch unvollständig");
  }
  if (status === "INVALID") missingFields.push("Gaststatus ist ungültig — Owner-Prüfung nötig");
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
  } else if (status === "EVISITOR_CONFIRMED_MANUAL") {
    eVisitorStatus = "MANUAL_CONFIRMED";
  } else if (status === "EVISITOR_READY") {
    eVisitorStatus = "READY_NOT_SUBMITTED";
  } else if (status === "OWNER_APPROVED") {
    eVisitorStatus = "APPROVED_NOT_READY";
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
  if (access === "manager") return MOBILE_SECTIONS.includes(section);
  return section === "cleaning";
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
  const upcomingMasterIdentities = new Set([
    ...options.events
      .filter((event) => event.endDate > options.today)
      .map((event) => `${event.startDate}|${event.endDate}`),
    ...options.reservations
      .filter((reservation) => dateOnly(reservation.checkOut) > options.today)
      .map((reservation) => `${dateOnly(reservation.checkIn)}|${dateOnly(reservation.checkOut)}`),
  ]);
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
    // The master can contain both an imported event and its locally claimed
    // reservation. Count the date range once, matching the feed's public
    // date-range deduplication instead of exposing internal row count.
    upcomingEvents: upcomingMasterIdentities.size,
    lastKnownOccupancyEnd: [
      ...options.events.map((event) => event.endDate),
      ...options.reservations.map((reservation) => dateOnly(reservation.checkOut)),
    ].sort().at(-1) ?? null,
  });
  return cards;
}
