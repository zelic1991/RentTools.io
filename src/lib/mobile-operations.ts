import "server-only";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPropertyAccess } from "@/lib/ownership";
import {
  DEFAULT_PROPERTY_TIME_ZONE,
  dateInTimeZone,
  getOwnerCalendarWindow,
} from "@/lib/owner-calendar-window";
import {
  canAccessMobileSection,
  buildMobilePortalCards,
  deriveMobileGuestState,
  mobileAvailabilityOverrides,
  redactedPlatformLabel,
  reservationGuestCount,
  safePlatformLabel,
  summarizeToday,
  type MobileAccessLevel,
  type MobilePortalCard,
  type MobileReservationInput,
  type MobileSection,
} from "@/lib/mobile-operations-core";

interface MobileCalendarReservation {
  id: number;
  name: string;
  checkIn: string;
  checkOut: string;
  platform: string;
  linkedEventUid?: string | null;
  linkedEventPlatform?: string | null;
  linkedEventRole?: "claim" | "extension" | null;
}

interface MobileCalendarEvent {
  platform: string;
  uid: string;
  summary: string;
  startDate: string;
  endDate: string;
}

export interface MobileReservationCard extends MobileReservationInput {
  label: string;
  guestCount: number | null;
  sourceLabel: string;
  guestState: ReturnType<typeof deriveMobileGuestState>;
}

export interface MobileOperationsData {
  section: MobileSection;
  access: MobileAccessLevel;
  canWrite: boolean;
  canSeeTechnicalDetails: boolean;
  selectedProperty: {
    id: number;
    name: string;
    checkInTime: string;
    checkOutTime: string;
  };
  today: string;
  start: {
    arrivals: MobileReservationCard[];
    departures: MobileReservationCard[];
    occupied: MobileReservationCard[];
    next: MobileReservationCard | null;
    openGuestTasks: MobileReservationCard[];
    ownerReviews: MobileReservationCard[];
    openEVisitor: MobileReservationCard[];
    portalProblems: number;
  };
  guests: MobileReservationCard[];
  portals: MobilePortalCard[];
  calendar: {
    property: {
      minNights: number;
      checkInTime: string;
      checkOutTime: string;
      bookingWindow: number;
      cleaningEnabled: boolean;
      reservations: MobileCalendarReservation[];
    };
    events: MobileCalendarEvent[];
    links: Array<{ platform: string; bufferBefore: number; bufferAfter: number }>;
    overrides: Array<{ date: string; type: "open" | "closed" | "cleaning" }>;
    visibleFrom: string;
    visibleUntil: string;
  };
}

const RESERVATION_SELECT = {
  id: true,
  name: true,
  checkIn: true,
  checkOut: true,
  platform: true,
  linkedEventUid: true,
  linkedEventPlatform: true,
  linkedEventRole: true,
  bookedGuestCount: true,
  propertyId: true,
  createdAt: true,
  _count: { select: { guests: true } },
  guestFormSubmissions: {
    select: { status: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
  eVisitorReceipts: {
    select: {
      environment: true,
      status: true,
      readbackConfirmedAt: true,
      attemptedAt: true,
    },
    orderBy: { attemptedAt: "asc" as const },
  },
} as const;

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function calendarPlatform(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("airbnb")) return "airbnb";
  if (normalized.includes("booking")) return "booking";
  if (normalized.includes("laganini")) return "laganini";
  if (normalized.includes("ubyt") || normalized.includes("reklama")) return "ubytovani";
  if (normalized === "direct") return "direct";
  return "other";
}

function reservationInput(row: {
  id: number;
  checkIn: Date;
  checkOut: Date;
  platform: string;
  bookedGuestCount: number | null;
  _count: { guests: number };
  guestFormSubmissions: Array<{ status: string; createdAt: Date }>;
  eVisitorReceipts: Array<{
    environment: string;
    status: string;
    readbackConfirmedAt: Date | null;
    attemptedAt: Date;
  }>;
}): MobileReservationInput {
  return {
    id: row.id,
    checkIn: isoDate(row.checkIn),
    checkOut: isoDate(row.checkOut),
    platform: row.platform,
    bookedGuestCount: row.bookedGuestCount,
    persistedGuestCount: row._count.guests,
    submissions: row.guestFormSubmissions.map((submission) => ({
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
    })),
    eVisitorReceipts: row.eVisitorReceipts.map((receipt) => ({
      environment: receipt.environment,
      status: receipt.status,
      readbackConfirmedAt: receipt.readbackConfirmedAt?.toISOString() ?? null,
      attemptedAt: receipt.attemptedAt.toISOString(),
    })),
  };
}

export async function loadMobileOperations(options: {
  section: MobileSection;
}): Promise<MobileOperationsData> {
  const session = await getSession();
  if (!session) redirect(`/login?next=/mobile${options.section === "start" ? "" : `/${options.section}`}`);
  if (session.role === "cleaner") redirect("/dashboard");

  const propertyWhere = {
    OR: [
      { userId: session.userId },
      { managers: { some: { managerId: session.userId } } },
    ],
  };
  const selectedOption = await prisma.property.findFirst({
    where: propertyWhere,
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  if (!selectedOption) redirect("/dashboard");

  const resolvedAccess = await getPropertyAccess(selectedOption.id, session.userId, session.role);
  if (resolvedAccess === "none") redirect("/mobile");
  const access = resolvedAccess as MobileAccessLevel;
  if (!canAccessMobileSection(access, options.section)) {
    redirect("/mobile");
  }
  const section = options.section;
  const canReadPii = !session.impersonatorId;
  const canWrite = !session.impersonatorId;

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: selectedOption.id },
    select: {
      id: true,
      userId: true,
      name: true,
      minNights: true,
      checkInTime: true,
      checkOutTime: true,
      bookingWindow: true,
      cleaningEnabled: true,
      feedToken: true,
      feedSlug: true,
      createdAt: true,
      calendarLinks: {
        select: {
          id: true,
          propertyId: true,
          platform: true,
          icalExportUrl: true,
          bufferBefore: true,
          bufferAfter: true,
          lastFetchedAt: true,
          lastError: true,
          failureCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      calendarEvents: {
        select: {
          id: true,
          platform: true,
          uid: true,
          summary: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: "asc" },
      },
      dateOverrides: {
        select: {
          id: true,
          propertyId: true,
          date: true,
          type: true,
          note: true,
          createdAt: true,
        },
        orderBy: { date: "asc" },
      },
      reservations: {
        select: RESERVATION_SELECT,
        orderBy: { checkIn: "asc" },
      },
    },
  });

  const today = dateInTimeZone(new Date(), DEFAULT_PROPERTY_TIME_ZONE);
  const inputs = property.reservations.map(reservationInput);
  const byId = new Map(property.reservations.map((reservation) => [reservation.id, reservation]));
  const toCard = (input: MobileReservationInput): MobileReservationCard => {
    const source = byId.get(input.id)!;
    return {
      ...input,
      label: canReadPii ? source.name : "Reservierung",
      guestCount: canReadPii ? reservationGuestCount(input) : null,
      sourceLabel: canReadPii
        ? safePlatformLabel(input.platform)
        : redactedPlatformLabel(input.platform),
      guestState: deriveMobileGuestState(input),
    };
  };
  const cards = inputs.map(toCard);
  const todaySummary = summarizeToday(inputs, today);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const cardList = (rows: MobileReservationInput[]) => rows.map((row) => cardsById.get(row.id)!);

  const portals = buildMobilePortalCards({
    links: property.calendarLinks,
    events: property.calendarEvents,
    reservations: property.reservations,
    today,
    feedSlug: property.feedSlug,
    feedToken: property.feedToken,
  });
  const window = getOwnerCalendarWindow({
    bookingWindowDays: property.bookingWindow,
    timeZone: DEFAULT_PROPERTY_TIME_ZONE,
  });
  const eventUidMap = new Map(
    property.calendarEvents.map((event, index) => [
      `${event.platform}|${event.uid}`,
      `event-${index + 1}`,
    ]),
  );
  const calendarReservations: MobileCalendarReservation[] = property.reservations.map((reservation) => ({
    id: reservation.id,
    name: canReadPii ? reservation.name : redactedPlatformLabel(reservation.platform),
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    platform: calendarPlatform(reservation.platform),
    linkedEventUid: reservation.linkedEventUid
      ? eventUidMap.get(`${reservation.linkedEventPlatform || reservation.platform}|${reservation.linkedEventUid}`) ?? null
      : null,
    linkedEventPlatform: reservation.linkedEventPlatform
      ? calendarPlatform(reservation.linkedEventPlatform)
      : null,
    linkedEventRole: reservation.linkedEventRole as "claim" | "extension" | null,
  }));
  const calendarProperty = {
    minNights: property.minNights,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    bookingWindow: property.bookingWindow,
    cleaningEnabled: property.cleaningEnabled,
    reservations: calendarReservations,
  };
  const calendarLinks = property.calendarLinks.map((link) => ({
    platform: calendarPlatform(link.platform),
    bufferBefore: link.bufferBefore,
    bufferAfter: link.bufferAfter,
  }));
  const calendarEvents: MobileCalendarEvent[] = property.calendarEvents.map((event) => ({
    platform: calendarPlatform(event.platform),
    uid: eventUidMap.get(`${event.platform}|${event.uid}`)!,
    summary: redactedPlatformLabel(event.platform),
    startDate: event.startDate,
    endDate: event.endDate,
  }));
  // Cleaning overrides are operational metadata only for this one-apartment
  // mobile view. They neither surface as a workflow nor imply that a
  // checkout date is unavailable. Explicit open/closed overrides remain.
  const overrides = mobileAvailabilityOverrides(
    property.dateOverrides.map((override) => ({
      date: override.date,
      type: override.type as "open" | "closed" | "cleaning",
    })),
  );

  const upcomingCards = cards.filter((card) => card.checkOut >= today);
  const openGuestTasks = canReadPii
    ? upcomingCards.filter((card) => !card.guestState.complete)
    : [];
  const ownerReviews = canReadPii
    ? upcomingCards.filter((card) => card.guestState.ownerReviewRequired)
    : [];
  const openEVisitor = canReadPii
    ? upcomingCards.filter((card) =>
        card.guestState.eVisitorStatus === "READY_NOT_SUBMITTED"
        || card.guestState.eVisitorStatus === "PRODUCTION_ERROR",
      )
    : [];

  return {
    section,
    access,
    canWrite,
    canSeeTechnicalDetails: access === "owner" && !session.impersonatorId,
    selectedProperty: {
      id: property.id,
      name: property.name,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
    },
    today,
    start: {
      arrivals: cardList(todaySummary.arrivals),
      departures: cardList(todaySummary.departures),
      occupied: cardList(todaySummary.occupied),
      next: todaySummary.next ? cardsById.get(todaySummary.next.id) ?? null : null,
      openGuestTasks,
      ownerReviews,
      openEVisitor,
      portalProblems: portals.filter((portal) => portal.hasError).length,
    },
    guests: canReadPii ? upcomingCards : [],
    portals,
    calendar: {
      property: calendarProperty,
      events: calendarEvents,
      links: calendarLinks,
      overrides,
      visibleFrom: window.visibleFrom,
      visibleUntil: window.visibleUntil,
    },
  };
}
