import {
  normalizePrecheckinStatus,
  type PrecheckinStatus,
} from "@/lib/precheckin";
import { resolveCopy, type CopyMap, type Locale } from "@/lib/i18n/translations";

/**
 * Wording the phone screens show for derived states. German is the
 * default for every helper below, so callers that pass no locale (and the
 * tests) keep the German text the phone has always shown.
 */
const CORE_COPY: CopyMap<{
  guestFormNotCreated: string;
  guestDataIncomplete: string;
  guestStatusInvalid: string;
  guestLinkRevoked: string;
  direct: string;
  other: string;
  directWebsite: string;
  calendarFailed: (name: string) => string;
  calendarActive: string;
  noImport: string;
  noWebsiteConnector: string;
  feedProtected: string;
  feedUnprotected: string;
  noFeed: string;
}> = {
  en: {
    guestFormNotCreated: "Guest form not created yet",
    guestDataIncomplete: "Guest data still incomplete",
    guestStatusInvalid: "Guest status is invalid — owner check needed",
    guestLinkRevoked: "Guest link was revoked",
    direct: "Direct",
    other: "Other",
    directWebsite: "Direct website",
    calendarFailed: (name) => `The ${name} calendar could not be updated last time.`,
    calendarActive: "Calendar connection is active.",
    noImport: "No import found in RentTools; a possible outgoing feed is not verified here.",
    noWebsiteConnector: "No website connector found in RentTools; direct bookings are kept in the master calendar.",
    feedProtected: "Outgoing feed is set up and protected with a token.",
    feedUnprotected: "Outgoing feed is set up but not protected with a token.",
    noFeed: "No permanent outgoing feed set up.",
  },
  ru: {
    guestFormNotCreated: "Анкета гостя ещё не создана",
    guestDataIncomplete: "Данные гостей ещё не заполнены",
    guestStatusInvalid: "Недопустимый статус гостя — нужна проверка владельца",
    guestLinkRevoked: "Ссылка для гостя отозвана",
    direct: "Напрямую",
    other: "Другое",
    directWebsite: "Собственный сайт",
    calendarFailed: (name) => `Календарь ${name} в последний раз не удалось обновить.`,
    calendarActive: "Подключение календаря активно.",
    noImport: "Импорт в RentTools не обнаружен; возможный исходящий фид здесь не проверяется.",
    noWebsiteConnector: "Коннектор сайта в RentTools не обнаружен; прямые бронирования ведутся в основном календаре.",
    feedProtected: "Исходящий фид настроен и защищён токеном.",
    feedUnprotected: "Исходящий фид настроен, но не защищён токеном.",
    noFeed: "Постоянный исходящий фид не настроен.",
  },
  de: {
    guestFormNotCreated: "Gästeformular noch nicht erstellt",
    guestDataIncomplete: "Gästedaten noch unvollständig",
    guestStatusInvalid: "Gaststatus ist ungültig — Owner-Prüfung nötig",
    guestLinkRevoked: "Gastlink wurde widerrufen",
    direct: "Direkt",
    other: "Sonstige",
    directWebsite: "Direktwebsite",
    calendarFailed: (name) => `${name}-Kalender konnte zuletzt nicht aktualisiert werden.`,
    calendarActive: "Kalenderverbindung ist aktiv.",
    noImport: "Kein Import in RentTools nachweisbar; ein möglicher Ausgangsfeed wird hier nicht verifiziert.",
    noWebsiteConnector: "Kein eigener Website-Connector in RentTools nachweisbar; Direktbuchungen werden im Master geführt.",
    feedProtected: "Ausgangsfeed ist eingerichtet und mit Token geschützt.",
    feedUnprotected: "Ausgangsfeed ist eingerichtet, aber nicht mit Token geschützt.",
    noFeed: "Kein dauerhafter Ausgangsfeed eingerichtet.",
  },
  fr: {
    guestFormNotCreated: "Formulaire voyageur pas encore créé",
    guestDataIncomplete: "Données des voyageurs encore incomplètes",
    guestStatusInvalid: "Statut voyageur non valide — vérification du propriétaire nécessaire",
    guestLinkRevoked: "Le lien voyageur a été révoqué",
    direct: "Direct",
    other: "Autre",
    directWebsite: "Site direct",
    calendarFailed: (name) => `Le calendrier ${name} n’a pas pu être mis à jour la dernière fois.`,
    calendarActive: "La connexion du calendrier est active.",
    noImport: "Aucun import trouvé dans RentTools ; un éventuel flux sortant n’est pas vérifié ici.",
    noWebsiteConnector: "Aucun connecteur de site trouvé dans RentTools ; les réservations directes sont gérées dans le calendrier principal.",
    feedProtected: "Le flux sortant est configuré et protégé par un jeton.",
    feedUnprotected: "Le flux sortant est configuré, mais pas protégé par un jeton.",
    noFeed: "Aucun flux sortant permanent configuré.",
  },
  es: {
    guestFormNotCreated: "Formulario del huésped aún no creado",
    guestDataIncomplete: "Datos de huéspedes aún incompletos",
    guestStatusInvalid: "Estado del huésped no válido — revisión del propietario necesaria",
    guestLinkRevoked: "El enlace del huésped se ha revocado",
    direct: "Directa",
    other: "Otros",
    directWebsite: "Web directa",
    calendarFailed: (name) => `El calendario de ${name} no se pudo actualizar la última vez.`,
    calendarActive: "La conexión del calendario está activa.",
    noImport: "No consta ninguna importación en RentTools; aquí no se verifica un posible feed de salida.",
    noWebsiteConnector: "No consta ningún conector de web en RentTools; las reservas directas se gestionan en el calendario principal.",
    feedProtected: "El feed de salida está configurado y protegido con un token.",
    feedUnprotected: "El feed de salida está configurado, pero no protegido con un token.",
    noFeed: "No hay ningún feed de salida permanente configurado.",
  },
  hr: {
    guestFormNotCreated: "Obrazac za goste još nije stvoren",
    guestDataIncomplete: "Podaci gostiju još su nepotpuni",
    guestStatusInvalid: "Status gosta nije valjan — potrebna je provjera vlasnika",
    guestLinkRevoked: "Link za goste je opozvan",
    direct: "Izravno",
    other: "Ostalo",
    directWebsite: "Vlastita web-stranica",
    calendarFailed: (name) => `Kalendar ${name} zadnji put nije bilo moguće ažurirati.`,
    calendarActive: "Veza s kalendarom je aktivna.",
    noImport: "U RentToolsu nije pronađen uvoz; mogući izlazni feed ovdje se ne provjerava.",
    noWebsiteConnector: "U RentToolsu nije pronađen konektor za web-stranicu; izravne rezervacije vode se u glavnom kalendaru.",
    feedProtected: "Izlazni feed je postavljen i zaštićen tokenom.",
    feedUnprotected: "Izlazni feed je postavljen, ali nije zaštićen tokenom.",
    noFeed: "Nije postavljen trajni izlazni feed.",
  },
};

/**
 * The "guest data still incomplete" line as `deriveMobileGuestState`
 * writes it for `locale`, so a screen can recognise it in the list.
 */
export function guestDataIncompleteLabel(locale: Locale = "de"): string {
  return resolveCopy(CORE_COPY, locale).guestDataIncomplete;
}

export type MobileSection = "start" | "calendar" | "guests" | "portals" | "reports" | "cleaning";
export type MobileAccessLevel = "owner" | "manager" | "family" | "cleaner";

export const MOBILE_SECTIONS: readonly MobileSection[] = [
  "start",
  "calendar",
  "guests",
  "portals",
  "reports",
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
  locale: Locale = "de",
): MobileGuestState {
  const copy = resolveCopy(CORE_COPY, locale);
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
    missingFields.push(copy.guestFormNotCreated);
  } else if (status === "PENDING") {
    missingFields.push(copy.guestDataIncomplete);
  }
  if (status === "INVALID") missingFields.push(copy.guestStatusInvalid);
  if (status === "REVOKED") missingFields.push(copy.guestLinkRevoked);

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
  // Family (the owner's relatives running the apartment) sees the stays and
  // the stored revenue; portal wiring stays with owner and manager.
  if (access === "family") return ["start", "calendar", "guests", "reports", "cleaning"].includes(section);
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

export function safePlatformLabel(platform: string, locale: Locale = "de"): string {
  const copy = resolveCopy(CORE_COPY, locale);
  const normalized = platform.trim().toLowerCase();
  if (normalized === "airbnb") return "Airbnb";
  if (normalized === "booking") return "Booking.com";
  if (normalized === "direct") return copy.direct;
  if (normalized.includes("laganini")) return "Laganini";
  if (normalized.includes("ubyt") || normalized.includes("reklama")) return "REKLAMA/Ubytování";
  return platform.trim() || copy.other;
}

export function redactedPlatformLabel(platform: string, locale: Locale = "de"): string {
  // Decide on the German label, as before, so whether a platform counts
  // as recognised does not depend on the viewer's language.
  const safe = safePlatformLabel(platform);
  return safe === platform.trim()
    ? resolveCopy(CORE_COPY, locale).other
    : safePlatformLabel(platform, locale);
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
  locale?: Locale;
}): MobilePortalCard[] {
  const copy = resolveCopy(CORE_COPY, options.locale ?? "de");
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
          ? copy.calendarFailed(name)
          : copy.calendarActive
        : copy.noImport,
      upcomingEvents: upcomingIdentities.size,
      lastKnownOccupancyEnd: endDates.at(-1) ?? null,
    };
  });

  const directReservations = options.reservations.filter(
    (reservation) => reservation.platform.toLowerCase() === "direct",
  );
  cards.push({
    id: "website",
    name: copy.directWebsite,
    connected: null,
    lastSuccessfulSyncAt: null,
    lastAttemptAt: null,
    hasError: false,
    message: copy.noWebsiteConnector,
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
        ? copy.feedProtected
        : copy.feedUnprotected
      : copy.noFeed,
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
