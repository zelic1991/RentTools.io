import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  CircleHelp,
  Clock3,
  LogIn,
  LogOut,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { CleaningActions } from "@/components/mobile/cleaning-actions";
import { MobileCalendar } from "@/components/mobile/mobile-calendar";
import { MobileGuestLink } from "@/components/mobile/mobile-guest-link";
import { MobilePropertyTools } from "@/components/mobile/mobile-property-tools";
import { MobilePwaRegister } from "@/components/mobile/mobile-pwa-register";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { loadMobileOperations, type MobileOperationsData, type MobileReservationCard } from "@/lib/mobile-operations";
import { OperationalRemindersPanel } from "@/components/operational-reminders-panel";
import { loadMobileCleaning, type MobileCleaningData } from "@/lib/mobile-cleaning";
import {
  MOBILE_SECTIONS,
  guestDataIncompleteLabel,
  safePlatformLabel,
  type MobileSection,
} from "@/lib/mobile-operations-core";
import { getLocale } from "@/lib/i18n/server";
import { mobileIntlTag } from "@/lib/i18n/mobile-locale";
import { hrPlural, resolveCopy, type CopyMap, type Locale } from "@/lib/i18n/translations";

/** Russian picks the noun form by the same 1 / 2-4 / 5+ ends-in-digit
 *  rule (teens excepted) as Croatian, so the helper fits both. */
const ruPlural = hrPlural;

interface PageCopy {
  unknown: string;
  guests: (n: number) => string;
  today: (date: string) => string;
  whatHappens: string;
  occupied: string;
  free: string;
  arrivals: string;
  departures: string;
  inHouse: string;
  open: string;
  next: string;
  noNext: string;
  openItems: string;
  total: (n: number) => string;
  noOpenTasks: string;
  guestDataMissing: string;
  ownerReview: string;
  eVisitorOpen: string;
  bufferActive: string;
  portalProblem: string;
  quickAccess: string;
  openCalendar: string;
  createDirect: string;
  status: Record<string, string>;
  eVisitor: Record<string, string>;
  guestsEyebrow: string;
  guestsHeading: string;
  guestsHint: string;
  noGuests: string;
  guestCount: string;
  notConfirmed: string;
  fieldsNotStored: string;
  openGuestData: string;
  supportReadOnly: string;
  portalsEyebrow: string;
  portalsHeading: string;
  portalsHint: string;
  manual: string;
  connected: string;
  notConnected: string;
  lastSuccess: string;
  upcoming: string;
  occupiedUntil: string;
  lastAttempt: (date: string) => string;
  openDetails: string;
  ownerOnly: string;
  cleaningEyebrow: string;
  cleaningHeading: string;
  cleaningHint: string;
  noCleaning: string;
  cleaningStatus: Record<MobileCleaningData["tasks"][number]["status"], string>;
  responsible: string;
  note: string;
  familyToday: (date: string) => string;
  familyArrivals: (n: number) => string;
  familyDepartures: (n: number) => string;
  arrival: string;
  departure: string;
  familyEmpty: string;
  addReservation: string;
  calendar: string;
  guestsLink: string;
  cleaning: string;
  reportsEyebrow: string;
  reportsHeading: string;
  reportsHint: string;
  bookings: string;
  bookingsHint: (averageNights: string | null) => string;
  bookedNights: string;
  bookedNightsHint: string;
  storedAmounts: string;
  storedHint: (known: number, unknown: number, extraCurrencies: number) => string;
  perNight: string;
  perNightHint: string;
  byMonth: string;
  noAmount: string;
  byChannel: string;
  openChart: string;
  nights: (n: number) => string;
}

const COPY: CopyMap<PageCopy> = {
  en: {
    unknown: "Unknown",
    guests: (n) => `${n} ${n === 1 ? "guest" : "guests"}`,
    today: (date) => `Today · ${date}`,
    whatHappens: "What's happening?",
    occupied: "Occupied",
    free: "Free",
    arrivals: "Arrivals",
    departures: "Departures",
    inHouse: "In house",
    open: "Open",
    next: "Up next",
    noNext: "No upcoming reservation in the current booking window.",
    openItems: "Open items",
    total: (n) => `${n} in total`,
    noOpenTasks: "No open tasks based on the RentTools statuses currently on record.",
    guestDataMissing: "Guest data missing",
    ownerReview: "Owner review",
    eVisitorOpen: "eVisitor open",
    bufferActive: "Buffer days active",
    portalProblem: "Portal/feed problem",
    quickAccess: "Quick access",
    openCalendar: "Open calendar",
    createDirect: "Add direct reservation",
    status: {
      PENDING: "Guest data pending",
      GUEST_COMPLETE: "Completed by guest",
      OWNER_REVIEW: "Owner review in progress",
      NOT_INVITED: "Not invited",
      INVITED: "Link created",
      COMPLETE: "Complete",
      OWNER_REVIEW_REQUIRED: "Owner review needed",
      OWNER_APPROVED: "Approved",
      EVISITOR_READY: "Ready for manual handoff",
      EVISITOR_CONFIRMED_MANUAL: "Confirmed manually",
      REVOKED: "Revoked",
      INVALID: "Invalid status",
    },
    eVisitor: {
      NOT_READY: "Not ready yet",
      APPROVED_NOT_READY: "Approved, handoff pending",
      READY_NOT_SUBMITTED: "Ready, not sent",
      MANUAL_CONFIRMED: "Confirmed manually in eVisitor",
      PRODUCTION_PENDING: "Production run not confirmed yet",
      READBACK_CONFIRMED: "Readback confirmed",
      PRODUCTION_ERROR: "Production error",
    },
    guestsEyebrow: "Guests",
    guestsHeading: "Pre-check-in",
    guestsHint: "Only confirmed backend states – no automatic eVisitor action.",
    noGuests: "No current or upcoming reservation.",
    guestCount: "Number of guests",
    notConfirmed: "Not confirmed",
    fieldsNotStored: "Individual missing fields are not stored as plain-text status in the current secure draft.",
    openGuestData: "Open guest data",
    supportReadOnly: "Support view is read-only.",
    portalsEyebrow: "Portals",
    portalsHeading: "Connections",
    portalsHint: "Compact status view without feed URLs or raw technical logs.",
    manual: "Manual",
    connected: "Connected",
    notConnected: "Not connected",
    lastSuccess: "Last success",
    upcoming: "Upcoming entries",
    occupiedUntil: "Occupied until",
    lastAttempt: (date) => `Last fetch: ${date}. The previous successful time is not stored separately in the current data model.`,
    openDetails: "Open details",
    ownerOnly: "Technical feed details and error messages are owner-only.",
    cleaningEyebrow: "Cleaning",
    cleaningHeading: "Open tasks",
    cleaningHint: "Cleaning status is operational information only and does not change availability.",
    noCleaning: "No open cleaning tasks for the properties shared with you.",
    cleaningStatus: {
      PLANNED: "Planned",
      ASSIGNED: "Assigned",
      IN_PROGRESS: "In progress",
      READY: "Done",
      ISSUE: "Problem",
    },
    responsible: "Responsible",
    note: "Note",
    familyToday: (date) => `Today · ${date}`,
    familyArrivals: (n) => (n === 1 ? "Arrival" : "Arrivals"),
    familyDepartures: (n) => (n === 1 ? "Departure" : "Departures"),
    arrival: "Arrival",
    departure: "Departure",
    familyEmpty: "No arrivals or departures today.",
    addReservation: "+ Add reservation",
    calendar: "Calendar",
    guestsLink: "Guests",
    cleaning: "Cleaning",
    reportsEyebrow: "Reports",
    reportsHeading: "Figures",
    reportsHint: "Only amounts you entered yourself are added up – no prices, fees or estimates.",
    bookings: "Bookings",
    bookingsHint: (avg) => `since the start${avg === null ? "" : ` · ⌀ ${avg} nights`}`,
    bookedNights: "Booked nights",
    bookedNightsHint: "from today · excluding your own blocks",
    storedAmounts: "Stored amounts",
    storedHint: (known, unknown, extra) =>
      `since the start · ${known} with, ${unknown} without amount${extra > 0 ? ` · ${extra} more ${extra === 1 ? "currency" : "currencies"} below` : ""}`,
    perNight: "⌀ per night",
    perNightHint: "only bookings with an amount",
    byMonth: "By arrival month",
    noAmount: "No booking with an entered amount yet.",
    byChannel: "By channel",
    openChart: "Open chart and CSV export",
    nights: (n) => `${n} ${n === 1 ? "night" : "nights"}`,
  },
  ru: {
    unknown: "Неизвестно",
    guests: (n) => `${n} ${ruPlural(n, "гость", "гостя", "гостей")}`,
    today: (date) => `Сегодня · ${date}`,
    whatHappens: "Что происходит?",
    occupied: "Занято",
    free: "Свободно",
    arrivals: "Заезды",
    departures: "Выезды",
    inHouse: "В доме",
    open: "Открыто",
    next: "Далее",
    noNext: "В текущем окне бронирования нет следующего бронирования.",
    openItems: "Открытые пункты",
    total: (n) => `Всего: ${n}`,
    noOpenTasks: "Нет открытых задач по статусам, которые сейчас есть в RentTools.",
    guestDataMissing: "Нет данных гостей",
    ownerReview: "Проверка владельца",
    eVisitorOpen: "eVisitor не завершён",
    bufferActive: "Буферные дни активны",
    portalProblem: "Проблема с порталом/фидом",
    quickAccess: "Быстрый доступ",
    openCalendar: "Открыть календарь",
    createDirect: "Добавить прямое бронирование",
    status: {
      PENDING: "Ожидаются данные гостей",
      GUEST_COMPLETE: "Заполнено гостем",
      OWNER_REVIEW: "Идёт проверка владельца",
      NOT_INVITED: "Не приглашён",
      INVITED: "Ссылка создана",
      COMPLETE: "Заполнено",
      OWNER_REVIEW_REQUIRED: "Нужна проверка владельца",
      OWNER_APPROVED: "Одобрено",
      EVISITOR_READY: "Готово к ручной передаче",
      EVISITOR_CONFIRMED_MANUAL: "Подтверждено вручную",
      REVOKED: "Отозвано",
      INVALID: "Недопустимый статус",
    },
    eVisitor: {
      NOT_READY: "Ещё не готово",
      APPROVED_NOT_READY: "Одобрено, передача ожидается",
      READY_NOT_SUBMITTED: "Готово, не отправлено",
      MANUAL_CONFIRMED: "Подтверждено вручную в eVisitor",
      PRODUCTION_PENDING: "Рабочая отправка ещё не подтверждена",
      READBACK_CONFIRMED: "Обратная проверка подтверждена",
      PRODUCTION_ERROR: "Ошибка рабочей отправки",
    },
    guestsEyebrow: "Гости",
    guestsHeading: "Предварительная регистрация",
    guestsHint: "Только подтверждённые статусы системы – без автоматических действий в eVisitor.",
    noGuests: "Нет текущих или предстоящих бронирований.",
    guestCount: "Количество гостей",
    notConfirmed: "Не подтверждено",
    fieldsNotStored: "Отдельные недостающие поля в текущем защищённом черновике не сохраняются как открытый статус.",
    openGuestData: "Открыть данные гостей",
    supportReadOnly: "Режим поддержки доступен только для чтения.",
    portalsEyebrow: "Порталы",
    portalsHeading: "Подключения",
    portalsHint: "Краткий статус без адресов фидов и технических логов.",
    manual: "Вручную",
    connected: "Подключено",
    notConnected: "Не подключено",
    lastSuccess: "Последний успех",
    upcoming: "Предстоящие записи",
    occupiedUntil: "Занято до",
    lastAttempt: (date) => `Последний запрос: ${date}. Время предыдущей успешной синхронизации в текущей модели данных отдельно не хранится.`,
    openDetails: "Открыть подробности",
    ownerOnly: "Технические детали фидов и тексты ошибок видит только владелец.",
    cleaningEyebrow: "Уборка",
    cleaningHeading: "Открытые задачи",
    cleaningHint: "Статус уборки — только рабочая информация, он не меняет доступность.",
    noCleaning: "Нет открытых задач по уборке для доступных вам объектов.",
    cleaningStatus: {
      PLANNED: "Запланировано",
      ASSIGNED: "Назначено",
      IN_PROGRESS: "В работе",
      READY: "Готово",
      ISSUE: "Проблема",
    },
    responsible: "Ответственный",
    note: "Заметка",
    familyToday: (date) => `Сегодня · ${date}`,
    familyArrivals: (n) => ruPlural(n, "Заезд", "Заезда", "Заездов"),
    familyDepartures: (n) => ruPlural(n, "Выезд", "Выезда", "Выездов"),
    arrival: "Заезд",
    departure: "Выезд",
    familyEmpty: "Сегодня нет ни заездов, ни выездов.",
    addReservation: "+ Добавить бронирование",
    calendar: "Календарь",
    guestsLink: "Гости",
    cleaning: "Уборка",
    reportsEyebrow: "Отчёты",
    reportsHeading: "Цифры",
    reportsHint: "Суммируются только суммы, введённые вами, — без цен, сборов и оценок.",
    bookings: "Бронирования",
    bookingsHint: (avg) => `с начала${avg === null ? "" : ` · ⌀ ${avg} ноч.`}`,
    bookedNights: "Забронированные ночи",
    bookedNightsHint: "с сегодняшнего дня · без собственных блокировок",
    storedAmounts: "Сохранённые суммы",
    storedHint: (known, unknown, extra) =>
      `с начала · с суммой: ${known}, без суммы: ${unknown}${extra > 0 ? ` · ещё валют ниже: ${extra}` : ""}`,
    perNight: "⌀ за ночь",
    perNightHint: "только бронирования с суммой",
    byMonth: "По месяцу заезда",
    noAmount: "Пока нет бронирований с введённой суммой.",
    byChannel: "По каналу",
    openChart: "Открыть график и экспорт CSV",
    nights: (n) => `${n} ${ruPlural(n, "ночь", "ночи", "ночей")}`,
  },
  de: {
    unknown: "Unbekannt",
    guests: (n) => `${n} Gäste`,
    today: (date) => `Heute · ${date}`,
    whatHappens: "Was passiert?",
    occupied: "Belegt",
    free: "Frei",
    arrivals: "Anreisen",
    departures: "Abreisen",
    inHouse: "Im Haus",
    open: "Offen",
    next: "Als Nächstes",
    noNext: "Keine nächste Reservierung im aktuellen Buchungsfenster.",
    openItems: "Offene Punkte",
    total: (n) => `${n} insgesamt`,
    noOpenTasks: "Keine offenen Aufgaben aus den aktuell nachweisbaren RentTools-Statuswerten.",
    guestDataMissing: "Gästedaten fehlen",
    ownerReview: "Owner-Review",
    eVisitorOpen: "eVisitor offen",
    bufferActive: "Puffertage aktiv",
    portalProblem: "Portal-/Feedproblem",
    quickAccess: "Schnellzugriff",
    openCalendar: "Kalender öffnen",
    createDirect: "Direktreservierung anlegen",
    status: {
      PENDING: "Gästedaten ausstehend",
      GUEST_COMPLETE: "Vom Gast vollständig",
      OWNER_REVIEW: "Owner-Review läuft",
      NOT_INVITED: "Nicht eingeladen",
      INVITED: "Link erstellt",
      COMPLETE: "Vollständig",
      OWNER_REVIEW_REQUIRED: "Owner-Review nötig",
      OWNER_APPROVED: "Freigegeben",
      EVISITOR_READY: "Manuelle Übergabe bereit",
      EVISITOR_CONFIRMED_MANUAL: "Manuell bestätigt",
      REVOKED: "Widerrufen",
      INVALID: "Status ungültig",
    },
    eVisitor: {
      NOT_READY: "Noch nicht bereit",
      APPROVED_NOT_READY: "Freigegeben, Übergabe ausstehend",
      READY_NOT_SUBMITTED: "Bereit, nicht gesendet",
      MANUAL_CONFIRMED: "Manuell in eVisitor bestätigt",
      PRODUCTION_PENDING: "Produktionslauf noch unbestätigt",
      READBACK_CONFIRMED: "Readback bestätigt",
      PRODUCTION_ERROR: "Produktionsfehler",
    },
    guestsEyebrow: "Gäste",
    guestsHeading: "Pre-Check-in",
    guestsHint: "Nur bestätigte Backend-Zustände – keine automatische eVisitor-Aktion.",
    noGuests: "Keine aktuelle oder kommende Reservierung.",
    guestCount: "Gästezahl",
    notConfirmed: "Nicht bestätigt",
    fieldsNotStored: "Einzelne fehlende Felder werden im aktuellen sicheren Draft nicht als Klartext-Status gespeichert.",
    openGuestData: "Gastdaten öffnen",
    supportReadOnly: "Support-Ansicht ist schreibgeschützt.",
    portalsEyebrow: "Portale",
    portalsHeading: "Verbindungen",
    portalsHint: "Kompakte Statussicht ohne Feed-URLs oder technische Rohlogs.",
    manual: "Manuell",
    connected: "Verbunden",
    notConnected: "Nicht verbunden",
    lastSuccess: "Letzter Erfolg",
    upcoming: "Kommende Einträge",
    occupiedUntil: "Belegt bis",
    lastAttempt: (date) => `Letzter Abruf: ${date}. Der vorherige erfolgreiche Zeitpunkt wird im aktuellen Datenmodell nicht separat gespeichert.`,
    openDetails: "Details öffnen",
    ownerOnly: "Technische Feeddetails und Fehlertexte sind Owner-only.",
    cleaningEyebrow: "Reinigung",
    cleaningHeading: "Offene Aufgaben",
    cleaningHint: "Reinigungsstatus ist nur Betriebsinformation und verändert keine Verfügbarkeit.",
    noCleaning: "Keine offenen Reinigungsaufgaben für deine freigegebenen Objekte.",
    cleaningStatus: {
      PLANNED: "Geplant",
      ASSIGNED: "Zugewiesen",
      IN_PROGRESS: "In Arbeit",
      READY: "Fertig",
      ISSUE: "Problem",
    },
    responsible: "Zuständig",
    note: "Notiz",
    familyToday: (date) => `Heute · ${date}`,
    familyArrivals: (n) => (n === 1 ? "Anreise" : "Anreisen"),
    familyDepartures: (n) => (n === 1 ? "Abreise" : "Abreisen"),
    arrival: "Anreise",
    departure: "Abreise",
    familyEmpty: "Heute keine Anreisen oder Abreisen.",
    addReservation: "+ Reservierung hinzufügen",
    calendar: "Kalender",
    guestsLink: "Gäste",
    cleaning: "Reinigung",
    reportsEyebrow: "Berichte",
    reportsHeading: "Zahlen",
    reportsHint: "Summiert werden nur selbst eingetragene Beträge – keine Preise, Gebühren oder Schätzungen.",
    bookings: "Buchungen",
    bookingsHint: (avg) => `seit Beginn${avg === null ? "" : ` · ⌀ ${avg} Nächte`}`,
    bookedNights: "Gebuchte Nächte",
    bookedNightsHint: "ab heute · ohne eigene Sperren",
    storedAmounts: "Gespeicherte Beträge",
    storedHint: (known, unknown, extra) =>
      `seit Beginn · ${known} mit, ${unknown} ohne Betrag${extra > 0 ? ` · ${extra} weitere Währung${extra > 1 ? "en" : ""} unten` : ""}`,
    perNight: "⌀ pro Nacht",
    perNightHint: "nur Buchungen mit Betrag",
    byMonth: "Nach Anreisemonat",
    noAmount: "Noch keine Buchung mit eingetragenem Betrag.",
    byChannel: "Nach Kanal",
    openChart: "Diagramm und CSV-Export öffnen",
    nights: (n) => `${n} Nächte`,
  },
  fr: {
    unknown: "Inconnu",
    guests: (n) => `${n} ${n === 1 ? "voyageur" : "voyageurs"}`,
    today: (date) => `Aujourd’hui · ${date}`,
    whatHappens: "Que se passe-t-il ?",
    occupied: "Occupé",
    free: "Libre",
    arrivals: "Arrivées",
    departures: "Départs",
    inHouse: "Sur place",
    open: "En cours",
    next: "Prochainement",
    noNext: "Aucune prochaine réservation dans la fenêtre de réservation actuelle.",
    openItems: "Points en cours",
    total: (n) => `${n} au total`,
    noOpenTasks: "Aucune tâche en cours d’après les statuts RentTools actuellement enregistrés.",
    guestDataMissing: "Données voyageurs manquantes",
    ownerReview: "Vérification du propriétaire",
    eVisitorOpen: "eVisitor en attente",
    bufferActive: "Jours tampons actifs",
    portalProblem: "Problème de portail/flux",
    quickAccess: "Accès rapide",
    openCalendar: "Ouvrir le calendrier",
    createDirect: "Créer une réservation directe",
    status: {
      PENDING: "Données voyageurs en attente",
      GUEST_COMPLETE: "Complété par le voyageur",
      OWNER_REVIEW: "Vérification du propriétaire en cours",
      NOT_INVITED: "Non invité",
      INVITED: "Lien créé",
      COMPLETE: "Complet",
      OWNER_REVIEW_REQUIRED: "Vérification du propriétaire requise",
      OWNER_APPROVED: "Approuvé",
      EVISITOR_READY: "Prêt pour la transmission manuelle",
      EVISITOR_CONFIRMED_MANUAL: "Confirmé manuellement",
      REVOKED: "Révoqué",
      INVALID: "Statut non valide",
    },
    eVisitor: {
      NOT_READY: "Pas encore prêt",
      APPROVED_NOT_READY: "Approuvé, transmission en attente",
      READY_NOT_SUBMITTED: "Prêt, non envoyé",
      MANUAL_CONFIRMED: "Confirmé manuellement dans eVisitor",
      PRODUCTION_PENDING: "Envoi en production pas encore confirmé",
      READBACK_CONFIRMED: "Relecture confirmée",
      PRODUCTION_ERROR: "Erreur de production",
    },
    guestsEyebrow: "Voyageurs",
    guestsHeading: "Pré-enregistrement",
    guestsHint: "Uniquement des états confirmés par le système – aucune action eVisitor automatique.",
    noGuests: "Aucune réservation en cours ou à venir.",
    guestCount: "Nombre de voyageurs",
    notConfirmed: "Non confirmé",
    fieldsNotStored: "Les champs manquants individuels ne sont pas enregistrés en clair dans le brouillon sécurisé actuel.",
    openGuestData: "Ouvrir les données voyageurs",
    supportReadOnly: "La vue support est en lecture seule.",
    portalsEyebrow: "Portails",
    portalsHeading: "Connexions",
    portalsHint: "Vue d’état compacte, sans URL de flux ni journaux techniques bruts.",
    manual: "Manuel",
    connected: "Connecté",
    notConnected: "Non connecté",
    lastSuccess: "Dernier succès",
    upcoming: "Entrées à venir",
    occupiedUntil: "Occupé jusqu’au",
    lastAttempt: (date) => `Dernière récupération : ${date}. L’heure du succès précédent n’est pas enregistrée séparément dans le modèle de données actuel.`,
    openDetails: "Ouvrir les détails",
    ownerOnly: "Les détails techniques des flux et les messages d’erreur sont réservés au propriétaire.",
    cleaningEyebrow: "Ménage",
    cleaningHeading: "Tâches en cours",
    cleaningHint: "Le statut du ménage est une information opérationnelle et ne modifie pas la disponibilité.",
    noCleaning: "Aucune tâche de ménage en cours pour les logements partagés avec vous.",
    cleaningStatus: {
      PLANNED: "Prévu",
      ASSIGNED: "Attribué",
      IN_PROGRESS: "En cours",
      READY: "Terminé",
      ISSUE: "Problème",
    },
    responsible: "Responsable",
    note: "Note",
    familyToday: (date) => `Aujourd’hui · ${date}`,
    familyArrivals: (n) => (n === 1 ? "Arrivée" : "Arrivées"),
    familyDepartures: (n) => (n === 1 ? "Départ" : "Départs"),
    arrival: "Arrivée",
    departure: "Départ",
    familyEmpty: "Aucune arrivée ni aucun départ aujourd’hui.",
    addReservation: "+ Ajouter une réservation",
    calendar: "Calendrier",
    guestsLink: "Voyageurs",
    cleaning: "Ménage",
    reportsEyebrow: "Rapports",
    reportsHeading: "Chiffres",
    reportsHint: "Seuls les montants saisis vous-même sont additionnés – aucun prix, frais ni estimation.",
    bookings: "Réservations",
    bookingsHint: (avg) => `depuis le début${avg === null ? "" : ` · ⌀ ${avg} nuits`}`,
    bookedNights: "Nuits réservées",
    bookedNightsHint: "à partir d’aujourd’hui · hors blocages personnels",
    storedAmounts: "Montants enregistrés",
    storedHint: (known, unknown, extra) =>
      `depuis le début · ${known} avec, ${unknown} sans montant${extra > 0 ? ` · ${extra} autre${extra > 1 ? "s" : ""} devise${extra > 1 ? "s" : ""} ci-dessous` : ""}`,
    perNight: "⌀ par nuit",
    perNightHint: "uniquement les réservations avec montant",
    byMonth: "Par mois d’arrivée",
    noAmount: "Aucune réservation avec montant saisi pour l’instant.",
    byChannel: "Par canal",
    openChart: "Ouvrir le graphique et l’export CSV",
    nights: (n) => `${n} ${n === 1 ? "nuit" : "nuits"}`,
  },
  es: {
    unknown: "Desconocido",
    guests: (n) => `${n} ${n === 1 ? "huésped" : "huéspedes"}`,
    today: (date) => `Hoy · ${date}`,
    whatHappens: "¿Qué pasa hoy?",
    occupied: "Ocupado",
    free: "Libre",
    arrivals: "Llegadas",
    departures: "Salidas",
    inHouse: "En casa",
    open: "Pendiente",
    next: "A continuación",
    noNext: "No hay próxima reserva en el periodo de reservas actual.",
    openItems: "Puntos pendientes",
    total: (n) => `${n} en total`,
    noOpenTasks: "No hay tareas pendientes según los estados de RentTools registrados actualmente.",
    guestDataMissing: "Faltan datos de huéspedes",
    ownerReview: "Revisión del propietario",
    eVisitorOpen: "eVisitor pendiente",
    bufferActive: "Días tampón activos",
    portalProblem: "Problema de portal/feed",
    quickAccess: "Acceso rápido",
    openCalendar: "Abrir calendario",
    createDirect: "Crear reserva directa",
    status: {
      PENDING: "Datos de huéspedes pendientes",
      GUEST_COMPLETE: "Completado por el huésped",
      OWNER_REVIEW: "Revisión del propietario en curso",
      NOT_INVITED: "No invitado",
      INVITED: "Enlace creado",
      COMPLETE: "Completo",
      OWNER_REVIEW_REQUIRED: "Revisión del propietario necesaria",
      OWNER_APPROVED: "Aprobado",
      EVISITOR_READY: "Listo para entrega manual",
      EVISITOR_CONFIRMED_MANUAL: "Confirmado manualmente",
      REVOKED: "Revocado",
      INVALID: "Estado no válido",
    },
    eVisitor: {
      NOT_READY: "Aún no está listo",
      APPROVED_NOT_READY: "Aprobado, entrega pendiente",
      READY_NOT_SUBMITTED: "Listo, no enviado",
      MANUAL_CONFIRMED: "Confirmado manualmente en eVisitor",
      PRODUCTION_PENDING: "Envío en producción aún sin confirmar",
      READBACK_CONFIRMED: "Comprobación confirmada",
      PRODUCTION_ERROR: "Error de producción",
    },
    guestsEyebrow: "Huéspedes",
    guestsHeading: "Registro previo",
    guestsHint: "Solo estados confirmados del sistema – ninguna acción automática en eVisitor.",
    noGuests: "No hay ninguna reserva actual ni próxima.",
    guestCount: "Número de huéspedes",
    notConfirmed: "Sin confirmar",
    fieldsNotStored: "Los campos que faltan no se guardan como estado en texto plano en el borrador seguro actual.",
    openGuestData: "Abrir datos de huéspedes",
    supportReadOnly: "La vista de soporte es de solo lectura.",
    portalsEyebrow: "Portales",
    portalsHeading: "Conexiones",
    portalsHint: "Vista de estado compacta sin URL de feeds ni registros técnicos.",
    manual: "Manual",
    connected: "Conectado",
    notConnected: "No conectado",
    lastSuccess: "Último éxito",
    upcoming: "Próximas entradas",
    occupiedUntil: "Ocupado hasta",
    lastAttempt: (date) => `Última consulta: ${date}. La hora del éxito anterior no se guarda por separado en el modelo de datos actual.`,
    openDetails: "Abrir detalles",
    ownerOnly: "Los detalles técnicos de los feeds y los mensajes de error son solo para el propietario.",
    cleaningEyebrow: "Limpieza",
    cleaningHeading: "Tareas pendientes",
    cleaningHint: "El estado de limpieza es solo información operativa y no cambia la disponibilidad.",
    noCleaning: "No hay tareas de limpieza pendientes en los alojamientos compartidos contigo.",
    cleaningStatus: {
      PLANNED: "Planificada",
      ASSIGNED: "Asignada",
      IN_PROGRESS: "En curso",
      READY: "Hecha",
      ISSUE: "Problema",
    },
    responsible: "Responsable",
    note: "Nota",
    familyToday: (date) => `Hoy · ${date}`,
    familyArrivals: (n) => (n === 1 ? "Llegada" : "Llegadas"),
    familyDepartures: (n) => (n === 1 ? "Salida" : "Salidas"),
    arrival: "Llegada",
    departure: "Salida",
    familyEmpty: "Hoy no hay llegadas ni salidas.",
    addReservation: "+ Añadir reserva",
    calendar: "Calendario",
    guestsLink: "Huéspedes",
    cleaning: "Limpieza",
    reportsEyebrow: "Informes",
    reportsHeading: "Cifras",
    reportsHint: "Solo se suman los importes que has introducido tú – sin precios, comisiones ni estimaciones.",
    bookings: "Reservas",
    bookingsHint: (avg) => `desde el inicio${avg === null ? "" : ` · ⌀ ${avg} noches`}`,
    bookedNights: "Noches reservadas",
    bookedNightsHint: "desde hoy · sin bloqueos propios",
    storedAmounts: "Importes guardados",
    storedHint: (known, unknown, extra) =>
      `desde el inicio · ${known} con, ${unknown} sin importe${extra > 0 ? ` · ${extra} ${extra === 1 ? "moneda más" : "monedas más"} abajo` : ""}`,
    perNight: "⌀ por noche",
    perNightHint: "solo reservas con importe",
    byMonth: "Por mes de llegada",
    noAmount: "Todavía no hay reservas con importe introducido.",
    byChannel: "Por canal",
    openChart: "Abrir gráfico y exportación CSV",
    nights: (n) => `${n} ${n === 1 ? "noche" : "noches"}`,
  },
  hr: {
    unknown: "Nepoznato",
    guests: (n) => `${n} ${hrPlural(n, "gost", "gosta", "gostiju")}`,
    today: (date) => `Danas · ${date}`,
    whatHappens: "Što se događa?",
    occupied: "Zauzeto",
    free: "Slobodno",
    arrivals: "Dolasci",
    departures: "Odlasci",
    inHouse: "U kući",
    open: "Otvoreno",
    next: "Sljedeće",
    noNext: "Nema sljedeće rezervacije u trenutačnom razdoblju za rezervacije.",
    openItems: "Otvorene stavke",
    total: (n) => `Ukupno ${n}`,
    noOpenTasks: "Nema otvorenih zadataka prema statusima koji su trenutačno zabilježeni u RentToolsu.",
    guestDataMissing: "Nedostaju podaci gostiju",
    ownerReview: "Provjera vlasnika",
    eVisitorOpen: "eVisitor otvoren",
    bufferActive: "Aktivni dani pauze",
    portalProblem: "Problem s portalom/feedom",
    quickAccess: "Brzi pristup",
    openCalendar: "Otvori kalendar",
    createDirect: "Dodaj izravnu rezervaciju",
    status: {
      PENDING: "Čekaju se podaci gostiju",
      GUEST_COMPLETE: "Gost je ispunio obrazac",
      OWNER_REVIEW: "Provjera vlasnika u tijeku",
      NOT_INVITED: "Nije pozvan",
      INVITED: "Link stvoren",
      COMPLETE: "Potpuno",
      OWNER_REVIEW_REQUIRED: "Potrebna provjera vlasnika",
      OWNER_APPROVED: "Odobreno",
      EVISITOR_READY: "Spremno za ručni unos",
      EVISITOR_CONFIRMED_MANUAL: "Ručno potvrđeno",
      REVOKED: "Opozvano",
      INVALID: "Status nije valjan",
    },
    eVisitor: {
      NOT_READY: "Još nije spremno",
      APPROVED_NOT_READY: "Odobreno, čeka se predaja",
      READY_NOT_SUBMITTED: "Spremno, nije poslano",
      MANUAL_CONFIRMED: "Ručno potvrđeno u eVisitoru",
      PRODUCTION_PENDING: "Stvarno slanje još nije potvrđeno",
      READBACK_CONFIRMED: "Povratna provjera potvrđena",
      PRODUCTION_ERROR: "Pogreška pri stvarnom slanju",
    },
    guestsEyebrow: "Gosti",
    guestsHeading: "Prijava prije dolaska",
    guestsHint: "Samo potvrđena stanja iz sustava – bez automatske radnje u eVisitoru.",
    noGuests: "Nema trenutačne ni nadolazeće rezervacije.",
    guestCount: "Broj gostiju",
    notConfirmed: "Nije potvrđeno",
    fieldsNotStored: "Pojedinačna polja koja nedostaju ne spremaju se kao čitljiv status u trenutačnom zaštićenom nacrtu.",
    openGuestData: "Otvori podatke gostiju",
    supportReadOnly: "Prikaz podrške je samo za čitanje.",
    portalsEyebrow: "Portali",
    portalsHeading: "Veze",
    portalsHint: "Sažet prikaz statusa bez adresa feedova i tehničkih zapisa.",
    manual: "Ručno",
    connected: "Povezano",
    notConnected: "Nije povezano",
    lastSuccess: "Zadnji uspjeh",
    upcoming: "Nadolazeći unosi",
    occupiedUntil: "Zauzeto do",
    lastAttempt: (date) => `Zadnje dohvaćanje: ${date}. Vrijeme prethodnog uspješnog dohvaćanja u trenutačnom modelu podataka ne sprema se zasebno.`,
    openDetails: "Otvori detalje",
    ownerOnly: "Tehnički detalji feedova i poruke o pogreškama vidljivi su samo vlasniku.",
    cleaningEyebrow: "Čišćenje",
    cleaningHeading: "Otvoreni zadaci",
    cleaningHint: "Status čišćenja služi samo kao radna informacija i ne mijenja dostupnost.",
    noCleaning: "Nema otvorenih zadataka čišćenja za objekte koji su vam dodijeljeni.",
    cleaningStatus: {
      PLANNED: "Planirano",
      ASSIGNED: "Dodijeljeno",
      IN_PROGRESS: "U tijeku",
      READY: "Gotovo",
      ISSUE: "Problem",
    },
    responsible: "Zadužen/a",
    note: "Napomena",
    familyToday: (date) => `Danas · ${date}`,
    familyArrivals: (n) => hrPlural(n, "Dolazak", "Dolaska", "Dolazaka"),
    familyDepartures: (n) => hrPlural(n, "Odlazak", "Odlaska", "Odlazaka"),
    arrival: "Dolazak",
    departure: "Odlazak",
    familyEmpty: "Danas nema dolazaka ni odlazaka.",
    addReservation: "+ Dodaj rezervaciju",
    calendar: "Kalendar",
    guestsLink: "Gosti",
    cleaning: "Čišćenje",
    reportsEyebrow: "Izvješća",
    reportsHeading: "Brojke",
    reportsHint: "Zbrajaju se samo iznosi koje ste sami unijeli – bez cijena, naknada ili procjena.",
    bookings: "Rezervacije",
    bookingsHint: (avg) => `od početka${avg === null ? "" : ` · ⌀ ${avg} noćenja`}`,
    bookedNights: "Rezervirana noćenja",
    bookedNightsHint: "od danas · bez vlastitih blokada",
    storedAmounts: "Spremljeni iznosi",
    storedHint: (known, unknown, extra) =>
      `od početka · ${known} s iznosom, ${unknown} bez iznosa${extra > 0 ? ` · još ${extra} ${hrPlural(extra, "valuta", "valute", "valuta")} niže` : ""}`,
    perNight: "⌀ po noćenju",
    perNightHint: "samo rezervacije s iznosom",
    byMonth: "Po mjesecu dolaska",
    noAmount: "Još nema rezervacije s unesenim iznosom.",
    byChannel: "Po kanalu",
    openChart: "Otvori grafikon i izvoz u CSV",
    nights: (n) => `${n} ${hrPlural(n, "noćenje", "noćenja", "noćenja")}`,
  },
};

interface Fmt {
  date: (value: string) => string;
  month: (month: string) => string;
  money: (amountCents: number, currency: string) => string;
  dateTime: (value: string | null) => string;
  number: (value: number) => string;
}

function formatters(locale: Locale, copy: PageCopy): Fmt {
  const tag = mobileIntlTag(locale);
  const date = new Intl.DateTimeFormat(tag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const month = new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const dateTime = new Intl.DateTimeFormat(tag, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return {
    date: (value) => date.format(new Date(`${value}T12:00:00.000Z`)),
    month: (value) => month.format(new Date(`${value}-01T12:00:00.000Z`)),
    money: (amountCents, currency) =>
      new Intl.NumberFormat(tag, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amountCents / 100),
    dateTime: (value) => (value ? dateTime.format(new Date(value)) : copy.unknown),
    number: (value) => value.toLocaleString(tag),
  };
}

interface ScreenProps<T> {
  data: T;
  c: PageCopy;
  fmt: Fmt;
  locale: Locale;
}

function reservationHref(data: MobileOperationsData, reservationId: number): string {
  return `/dashboard?property=${data.selectedProperty.id}&reservation=${reservationId}&view=guests`;
}

function ReservationRow({
  data,
  reservation,
  direction,
  c,
  fmt,
}: {
  data: MobileOperationsData;
  reservation: MobileReservationCard;
  direction?: "arrival" | "departure";
  c: PageCopy;
  fmt: Fmt;
}) {
  const Icon = direction === "departure" ? LogOut : LogIn;
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--zf-surface)] text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{reservation.label}</span>
        <span className="mt-0.5 block text-xs text-[var(--zf-text-muted)] dark:text-slate-400">
          {fmt.date(reservation.checkIn)}–{fmt.date(reservation.checkOut)} · {reservation.sourceLabel}
          {reservation.guestCount ? ` · ${c.guests(reservation.guestCount)}` : ""}
        </span>
      </span>
      <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-[var(--zf-text-muted)]" />
    </>
  );
  const className = "flex min-h-16 items-center gap-3 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-3 py-2.5 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-800 dark:bg-slate-900";
  return !data.canWrite ? (
    <div className={className}>{content}</div>
  ) : (
    <Link href={reservationHref(data, reservation.id)} className={`${className} hover:border-[var(--zf-brand-pale)] hover:bg-[var(--zf-brand-soft)] dark:hover:border-[var(--zf-brand)] dark:hover:bg-[var(--zf-brand-dark)]/30`}>
      {content}
    </Link>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-[var(--zf-control-border)] bg-[var(--zf-surface)]/55 px-5 text-center text-sm text-[var(--zf-text-muted)] dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
      {children}
    </div>
  );
}

function StartScreen({ data, c, fmt }: ScreenProps<MobileOperationsData>) {
  const configuredBufferLinks = data.calendar.links.filter(
    (link) => link.bufferBefore > 0 || link.bufferAfter > 0,
  ).length;
  const openCount = data.start.openGuestTasks.length
    + data.start.ownerReviews.length
    + data.start.openEVisitor.length
    + data.start.portalProblems
    + configuredBufferLinks
    + data.operationalReminders.length;
  return (
    <div className="space-y-7">
      <section aria-labelledby="today-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--zf-brand)]">{c.today(fmt.date(data.today))}</p>
            <h2 id="today-heading" className="mt-1 text-2xl font-semibold tracking-tight">{c.whatHappens}</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.start.occupied.length ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
            {data.start.occupied.length ? c.occupied : c.free}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [c.arrivals, data.start.arrivals.length, LogIn],
            [c.departures, data.start.departures.length, LogOut],
            [c.inHouse, data.start.occupied.length, UsersRound],
            [c.open, openCount, AlertCircle],
          ].map(([label, count, Icon]) => {
            const CardIcon = Icon as typeof LogIn;
            return (
              <div key={String(label)} className="min-h-28 rounded-2xl border border-[var(--zf-border)] bg-[var(--zf-bg)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <CardIcon aria-hidden className="h-5 w-5 text-[var(--zf-brand)]" />
                <div className="mt-3 text-2xl font-semibold tabular-nums">{String(count)}</div>
                <div className="text-xs text-[var(--zf-text-muted)] dark:text-slate-400">{String(label)}</div>
              </div>
            );
          })}
        </div>
        {(data.start.arrivals.length > 0 || data.start.departures.length > 0) && (
          <div className="mt-3 space-y-2">
            {data.start.arrivals.map((reservation) => <ReservationRow key={`a-${reservation.id}`} data={data} reservation={reservation} direction="arrival" c={c} fmt={fmt} />)}
            {data.start.departures.map((reservation) => <ReservationRow key={`d-${reservation.id}`} data={data} reservation={reservation} direction="departure" c={c} fmt={fmt} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="next-heading">
        <h2 id="next-heading" className="mb-3 text-lg font-semibold tracking-tight">{c.next}</h2>
        {data.start.next ? <ReservationRow data={data} reservation={data.start.next} direction="arrival" c={c} fmt={fmt} /> : <EmptyState>{c.noNext}</EmptyState>}
      </section>

      <section aria-labelledby="tasks-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="tasks-heading" className="text-lg font-semibold tracking-tight">{c.openItems}</h2>
            <span className="text-xs text-[var(--zf-text-muted)]">{c.total(openCount)}</span>
          </div>
          {openCount === 0 ? (
            <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0" /> {c.noOpenTasks}
            </div>
          ) : (
            <div className="space-y-3">
              <OperationalRemindersPanel
                propertyId={data.selectedProperty.id}
                initialReminders={data.operationalReminders}
                compact
              />
              <div className="grid gap-2 sm:grid-cols-2">
              {[
                [c.guestDataMissing, data.start.openGuestTasks.length, "/mobile/guests"],
                [c.ownerReview, data.start.ownerReviews.length, "/mobile/guests"],
                [c.eVisitorOpen, data.start.openEVisitor.length, "/mobile/guests"],
                ...(configuredBufferLinks > 0
                  ? [[c.bufferActive, configuredBufferLinks, "/mobile/calendar"]]
                  : []),
                ...(data.start.portalProblems > 0
                  ? [[c.portalProblem, data.start.portalProblems, "/mobile/portals"]]
                  : []),
              ].map(([label, count, href]) => (
                <Link key={String(label)} href={String(href)} className="flex min-h-14 items-center justify-between rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 text-sm font-medium shadow-sm outline-none hover:border-[var(--zf-brand-pale)] hover:bg-[var(--zf-brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[var(--zf-brand)]">
                  <span>{String(label)}</span><span className="rounded-full bg-[var(--zf-surface)] px-2 py-0.5 tabular-nums dark:bg-slate-800">{String(count)}</span>
                </Link>
              ))}
              </div>
            </div>
          )}
      </section>

      <section aria-labelledby="quick-heading">
        <h2 id="quick-heading" className="mb-3 text-lg font-semibold tracking-tight">{c.quickAccess}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/mobile/calendar" className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--zf-brand-dark)] px-4 text-sm font-semibold text-[var(--zf-on-brand)] outline-none hover:bg-[var(--zf-brand)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:bg-white dark:text-slate-950">
            <Clock3 aria-hidden className="h-5 w-5" /> {c.openCalendar}
          </Link>
          {data.canWrite && (
            <Link href={`/dashboard?property=${data.selectedProperty.id}&view=calendar`} className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 text-sm font-semibold outline-none hover:bg-[var(--zf-surface)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
              <CalendarPlus aria-hidden className="h-5 w-5 text-[var(--zf-brand)]" /> {c.createDirect}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function GuestsScreen({ data, c, fmt, locale }: ScreenProps<MobileOperationsData>) {
  const incompleteLabel = guestDataIncompleteLabel(locale);
  return (
    <section aria-labelledby="guests-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--zf-brand)]">{c.guestsEyebrow}</p>
        <h2 id="guests-heading" className="mt-1 text-2xl font-semibold tracking-tight">{c.guestsHeading}</h2>
        <p className="mt-1 text-sm text-[var(--zf-text-muted)] dark:text-slate-400">{c.guestsHint}</p>
      </div>
      {data.guests.length === 0 ? <EmptyState>{c.noGuests}</EmptyState> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.guests.map((reservation) => (
            <article key={reservation.id} className="rounded-2xl border border-[var(--zf-border)] bg-[var(--zf-bg)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{reservation.label}</h3>
                  <p className="mt-0.5 text-xs text-[var(--zf-text-muted)] dark:text-slate-400">{fmt.date(reservation.checkIn)}–{fmt.date(reservation.checkOut)} · {reservation.sourceLabel}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${reservation.guestState.complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                  {c.status[reservation.guestState.status] ?? reservation.guestState.status}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-[var(--zf-surface)] p-3 dark:bg-slate-800/60"><dt className="text-xs text-[var(--zf-text-muted)] dark:text-slate-400">{c.guestCount}</dt><dd className="mt-1 font-semibold">{reservation.guestCount ?? c.notConfirmed}</dd></div>
                <div className="rounded-xl bg-[var(--zf-surface)] p-3 dark:bg-slate-800/60"><dt className="text-xs text-[var(--zf-text-muted)] dark:text-slate-400">eVisitor</dt><dd className="mt-1 font-semibold">{c.eVisitor[reservation.guestState.eVisitorStatus]}</dd></div>
              </dl>
              {reservation.guestState.missingFields.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {reservation.guestState.missingFields.join(" · ")}
                </div>
              )}
              {reservation.guestState.missingFields.includes(incompleteLabel) && (
                <p className="mt-2 text-[11px] text-[var(--zf-text-muted)] dark:text-slate-400">{c.fieldsNotStored}</p>
              )}
              {data.canWrite ? (
                <Link href={reservationHref(data, reservation.id)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--zf-brand-dark)] px-4 text-sm font-semibold text-[var(--zf-on-brand)] outline-none hover:bg-[var(--zf-brand)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:bg-white dark:text-slate-950">
                  {c.openGuestData} <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              ) : (
                <p className="mt-4 rounded-xl bg-[var(--zf-surface)] px-4 py-3 text-center text-xs text-[var(--zf-text-muted)] dark:bg-slate-800 dark:text-slate-300">{c.supportReadOnly}</p>
              )}
              {(data.access === "owner" || data.access === "manager") && (
                <MobileGuestLink
                  reservationId={reservation.id}
                  guestName={reservation.label}
                  bookedGuestCount={reservation.bookedGuestCount}
                  canWrite={data.canWrite}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PortalsScreen({ data, c, fmt }: ScreenProps<MobileOperationsData>) {
  return (
    <section aria-labelledby="portals-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--zf-brand)]">{c.portalsEyebrow}</p>
        <h2 id="portals-heading" className="mt-1 text-2xl font-semibold tracking-tight">{c.portalsHeading}</h2>
        <p className="mt-1 text-sm text-[var(--zf-text-muted)] dark:text-slate-400">{c.portalsHint}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.portals.map((portal) => {
          const Icon = portal.hasError ? AlertCircle : portal.connected === false ? CircleHelp : ShieldCheck;
          const tone = portal.hasError
            ? "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"
            : "border-[var(--zf-border)] bg-[var(--zf-bg)] dark:border-slate-800 dark:bg-slate-900";
          return (
            <article key={portal.id} className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${portal.hasError ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{portal.name}</h3><span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--zf-text-muted)]">{portal.connected === null ? c.manual : portal.connected ? c.connected : c.notConnected}</span></div>
                  <p className="mt-1 text-sm text-[var(--zf-text-muted)] dark:text-slate-300">{portal.message}</p>
                </div>
              </div>
              <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--zf-surface)] p-3 dark:bg-slate-950/50"><dt className="text-[var(--zf-text-muted)]">{c.lastSuccess}</dt><dd className="mt-1 font-medium">{fmt.dateTime(portal.lastSuccessfulSyncAt)}</dd></div>
                <div className="rounded-xl bg-[var(--zf-surface)] p-3 dark:bg-slate-950/50"><dt className="text-[var(--zf-text-muted)]">{c.upcoming}</dt><dd className="mt-1 font-medium tabular-nums">{portal.upcomingEvents}</dd></div>
                <div className="rounded-xl bg-[var(--zf-surface)] p-3 dark:bg-slate-950/50"><dt className="text-[var(--zf-text-muted)]">{c.occupiedUntil}</dt><dd className="mt-1 font-medium">{portal.lastKnownOccupancyEnd ? fmt.date(portal.lastKnownOccupancyEnd) : c.unknown}</dd></div>
              </dl>
              {portal.hasError && portal.lastAttemptAt && !portal.lastSuccessfulSyncAt && (
                <p className="mt-2 text-[11px] text-[var(--zf-text-muted)] dark:text-slate-400">{c.lastAttempt(fmt.dateTime(portal.lastAttemptAt))}</p>
              )}
              {data.canSeeTechnicalDetails && (
                <Link href={`/dashboard?property=${data.selectedProperty.id}&view=sync`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--zf-brand)] outline-none hover:text-[var(--zf-brand-hover)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:text-[var(--zf-brand-pale)]">{c.openDetails} <ArrowRight aria-hidden className="h-4 w-4" /></Link>
              )}
            </article>
          );
        })}
      </div>
      {!data.canSeeTechnicalDetails && (
        <div className="rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 py-3 text-sm text-[var(--zf-text-muted)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{c.ownerOnly}</div>
      )}
      {data.canWrite && (data.access === "owner" || data.access === "manager") && (
        <MobilePropertyTools
          propertyId={data.selectedProperty.id}
          minNights={data.calendar.property.minNights}
          checkInTime={data.calendar.property.checkInTime}
          checkOutTime={data.calendar.property.checkOutTime}
        />
      )}
    </section>
  );
}

function CleaningScreen({ data, c, fmt }: ScreenProps<MobileCleaningData>) {
  return (
    <section aria-labelledby="cleaning-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7B2E62]">{c.cleaningEyebrow}</p>
        <h2 id="cleaning-heading" className="mt-1 text-2xl font-semibold tracking-tight">{c.cleaningHeading}</h2>
        <p className="mt-1 text-sm text-[#685C4B]">
          {c.cleaningHint}
        </p>
      </div>
      {data.tasks.length === 0 ? (
        <EmptyState>{c.noCleaning}</EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-[#D6C8AE] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-[#2B241D]">{task.propertyName}</h3>
                  <p className="mt-1 text-sm text-[#685C4B]">{fmt.date(task.date)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${task.status === "ISSUE" ? "bg-rose-100 text-rose-800" : task.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-800" : "bg-[#F8EFF4] text-[#3F1735]"}`}>
                  {c.cleaningStatus[task.status]}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="rounded-xl bg-[#F6F1E6] p-3">
                  <dt className="text-xs text-[#685C4B]">{c.responsible}</dt>
                  <dd className="mt-1 font-medium text-[#2B241D]">{task.assigneeName}</dd>
                </div>
                {task.notes && (
                  <div className="rounded-xl bg-[#F6F1E6] p-3">
                    <dt className="text-xs text-[#685C4B]">{c.note}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[#2B241D]">{task.notes}</dd>
                  </div>
                )}
              </dl>
              {data.access === "cleaner" && data.canWrite && (
                <CleaningActions propertyId={task.propertyId} date={task.date} status={task.status} />
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FamilyStartScreen({ data, c, fmt }: ScreenProps<MobileOperationsData>) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#7B2E62] p-5 text-[#F9F4EF]">
        <p className="text-sm opacity-85">{c.familyToday(fmt.date(data.today))}</p>
        <h2 className="mt-1 text-2xl font-semibold">{c.whatHappens}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/15 p-3"><div className="text-2xl font-semibold">{data.start.arrivals.length}</div><div className="text-sm">{c.familyArrivals(data.start.arrivals.length)}</div></div>
          <div className="rounded-xl bg-white/15 p-3"><div className="text-2xl font-semibold">{data.start.departures.length}</div><div className="text-sm">{c.familyDepartures(data.start.departures.length)}</div></div>
        </div>
      </section>
      <section className="space-y-2">
        {data.start.arrivals.map((r) => <div key={`a-${r.id}`} className="rounded-xl border border-[#D6C8AE] bg-white p-4"><b>{c.arrival}</b><div className="mt-1">{r.label}</div><div className="text-sm text-[#685C4B]">{fmt.date(r.checkIn)}</div></div>)}
        {data.start.departures.map((r) => <div key={`d-${r.id}`} className="rounded-xl border border-[#D6C8AE] bg-white p-4"><b>{c.departure}</b><div className="mt-1">{r.label}</div><div className="text-sm text-[#685C4B]">{fmt.date(r.checkOut)}</div></div>)}
        {data.start.arrivals.length === 0 && data.start.departures.length === 0 && <EmptyState>{c.familyEmpty}</EmptyState>}
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/family/reservation?property=${data.selectedProperty.id}`} className="flex min-h-14 items-center justify-center rounded-xl bg-[#7B2E62] px-4 text-center font-semibold text-[#F9F4EF]">{c.addReservation}</Link>
        <Link href="/mobile/calendar" className="flex min-h-14 items-center justify-center rounded-xl border border-[#D6C8AE] bg-white px-4 text-center font-semibold">{c.calendar}</Link>
        <Link href="/mobile/guests" className="flex min-h-14 items-center justify-center rounded-xl border border-[#D6C8AE] bg-white px-4 text-center font-semibold">{c.guestsLink}</Link>
        <Link href="/mobile/cleaning" className="flex min-h-14 items-center justify-center rounded-xl border border-[#D6C8AE] bg-white px-4 text-center font-semibold">{c.cleaning}</Link>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--zf-border)] bg-[var(--zf-bg)] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* 24px overflows the 134px a tile gets on a 375px screen as soon
          as the season total reaches five digits; 20px carries six. */}
      <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
      <div className="mt-1 text-xs text-[var(--zf-text-muted)] dark:text-slate-400">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-[var(--zf-text-muted)] dark:text-slate-500">{hint}</div>}
    </div>
  );
}

function AmountRow({ label, nights, amount }: { label: string; nights: string; amount: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--zf-text-muted)] tabular-nums dark:text-slate-400">{nights}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{amount}</span>
    </div>
  );
}

function ReportsScreen({ data, c, fmt, locale }: ScreenProps<MobileOperationsData>) {
  const { reports } = data;
  const totals = reports.stored.totalsByCurrency;
  const averages = reports.breakdown.averageNightlyCents;
  return (
    <section aria-labelledby="reports-heading" className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--zf-brand)]">{c.reportsEyebrow}</p>
        <h2 id="reports-heading" className="mt-1 text-2xl font-semibold tracking-tight">{c.reportsHeading}</h2>
        <p className="mt-1 text-sm text-[var(--zf-text-muted)] dark:text-slate-400">
          {c.reportsHint}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={c.bookings}
          value={String(reports.bookings)}
          hint={c.bookingsHint(reports.averageNights === null ? null : fmt.number(reports.averageNights))}
        />
        <StatTile
          label={c.bookedNights}
          value={String(reports.upcomingNights)}
          hint={c.bookedNightsHint}
        />
        <StatTile
          label={c.storedAmounts}
          value={totals.length > 0 ? fmt.money(totals[0].amountCents, totals[0].currency) : "–"}
          hint={c.storedHint(reports.stored.knownCount, reports.stored.unknownCount, Math.max(0, totals.length - 1))}
        />
        <StatTile
          label={c.perNight}
          value={averages.length > 0 ? fmt.money(averages[0].amountCents, averages[0].currency) : "–"}
          hint={c.perNightHint}
        />
      </div>

      {totals.length > 1 && (
        <div className="rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          {totals.map((total) => (
            <div key={total.currency} className="flex justify-between gap-3 tabular-nums">
              <span>{total.currency}</span>
              <span className="font-semibold">{fmt.money(total.amountCents, total.currency)}</span>
            </div>
          ))}
        </div>
      )}

      <section aria-labelledby="reports-months" className="space-y-2">
        <h3 id="reports-months" className="text-lg font-semibold tracking-tight">{c.byMonth}</h3>
        {reports.breakdown.byMonth.length === 0 ? (
          <EmptyState>{c.noAmount}</EmptyState>
        ) : (
          reports.breakdown.byMonth.map((row) => (
            <AmountRow
              key={`${row.month}-${row.currency}`}
              label={fmt.month(row.month)}
              nights={c.nights(row.nights)}
              amount={fmt.money(row.amountCents, row.currency)}
            />
          ))
        )}
      </section>

      <section aria-labelledby="reports-channels" className="space-y-2">
        <h3 id="reports-channels" className="text-lg font-semibold tracking-tight">{c.byChannel}</h3>
        {reports.breakdown.byChannel.length === 0 ? (
          <EmptyState>{c.noAmount}</EmptyState>
        ) : (
          reports.breakdown.byChannel.map((row) => (
            <AmountRow
              key={`${row.platform}-${row.currency}`}
              label={safePlatformLabel(row.platform, locale)}
              nights={c.nights(row.nights)}
              amount={fmt.money(row.amountCents, row.currency)}
            />
          ))
        )}
      </section>

      <Link
        href={`/dashboard?property=${data.selectedProperty.id}&view=reports`}
        className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--zf-border)] bg-[var(--zf-bg)] px-4 text-sm font-semibold outline-none hover:border-[var(--zf-brand-pale)] hover:bg-[var(--zf-brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] dark:border-slate-800 dark:bg-slate-900"
      >
        {c.openChart} <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    </section>
  );
}

export default async function MobileOperationsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const route = await params;
  if ((route.section?.length ?? 0) > 1) notFound();
  const rawSection = route.section?.[0] ?? "start";
  if (!MOBILE_SECTIONS.includes(rawSection as MobileSection)) notFound();
  const locale = await getLocale();
  const c = resolveCopy(COPY, locale);
  const fmt = formatters(locale, c);
  if (rawSection === "cleaning") {
    const data = await loadMobileCleaning(locale);
    return (
      <MobileShell data={data} locale={locale}>
        <MobilePwaRegister />
        <CleaningScreen data={data} c={c} fmt={fmt} locale={locale} />
      </MobileShell>
    );
  }
  const data = await loadMobileOperations({
    section: rawSection as MobileSection,
    locale,
  });
  const screen = { data, c, fmt, locale };

  return (
    <MobileShell data={data} locale={locale}>
      <MobilePwaRegister />
      {data.section === "start" && (data.access === "family" ? <FamilyStartScreen {...screen} /> : <StartScreen {...screen} />)}
      {data.section === "calendar" && <MobileCalendar data={data} />}
      {data.section === "guests" && <GuestsScreen {...screen} />}
      {data.section === "portals" && <PortalsScreen {...screen} />}
      {data.section === "reports" && <ReportsScreen {...screen} />}
    </MobileShell>
  );
}
