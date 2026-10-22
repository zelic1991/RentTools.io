import Link from "next/link";
import {
  CalendarDays,
  ChartColumn,
  CircleUserRound,
  House,
  LockKeyhole,
  RadioTower,
  Sparkles,
} from "lucide-react";
import type { MobileOperationsData } from "@/lib/mobile-operations";
import type { MobileCleaningData } from "@/lib/mobile-cleaning";
import { canAccessMobileSection, type MobileSection } from "@/lib/mobile-operations-core";
import { MobileLanguageSwitcher } from "@/components/mobile/mobile-language-switcher";
import { resolveCopy, type CopyMap, type Locale } from "@/lib/i18n/translations";

const NAVIGATION: Array<{
  section: MobileSection;
  href: string;
  icon: typeof House;
}> = [
  { section: "start", href: "/mobile", icon: House },
  { section: "calendar", href: "/mobile/calendar", icon: CalendarDays },
  { section: "guests", href: "/mobile/guests", icon: CircleUserRound },
  { section: "portals", href: "/mobile/portals", icon: RadioTower },
  { section: "reports", href: "/mobile/reports", icon: ChartColumn },
  { section: "cleaning", href: "/mobile/cleaning", icon: Sparkles },
];

const COPY: CopyMap<{
  title: string;
  nav: Record<MobileSection, string>;
  roles: Record<"owner" | "manager" | "family" | "cleaner", string>;
  navLabel: string;
  locked: string;
  familyRevenue: string;
}> = {
  en: {
    title: "Operations",
    nav: { start: "Start", calendar: "Calendar", guests: "Guests", portals: "Portals", reports: "Reports", cleaning: "Cleaning" },
    roles: { owner: "Owner", manager: "Manager", family: "Family", cleaner: "Cleaner" },
    navLabel: "Mobile main navigation",
    familyRevenue: "Revenue",
    locked: "Not available for this role",
  },
  ru: {
    title: "Работа",
    nav: { start: "Главная", calendar: "Календарь", guests: "Гости", portals: "Порталы", reports: "Отчёты", cleaning: "Уборка" },
    roles: { owner: "Владелец", manager: "Менеджер", family: "Семья", cleaner: "Уборщик" },
    navLabel: "Основная мобильная навигация",
    familyRevenue: "Доход",
    locked: "Недоступно для этой роли",
  },
  de: {
    title: "Betrieb",
    nav: { start: "Start", calendar: "Kalender", guests: "Gäste", portals: "Portale", reports: "Berichte", cleaning: "Reinigung" },
    roles: { owner: "Owner", manager: "Manager", family: "Familie", cleaner: "Cleaner" },
    navLabel: "Mobile Hauptnavigation",
    familyRevenue: "Umsatz",
    locked: "Für diese Rolle nicht freigegeben",
  },
  fr: {
    title: "Exploitation",
    nav: { start: "Accueil", calendar: "Calendrier", guests: "Voyageurs", portals: "Portails", reports: "Rapports", cleaning: "Ménage" },
    roles: { owner: "Propriétaire", manager: "Gestionnaire", family: "Famille", cleaner: "Ménage" },
    navLabel: "Navigation principale mobile",
    familyRevenue: "Revenus",
    locked: "Non disponible pour ce rôle",
  },
  es: {
    title: "Operaciones",
    nav: { start: "Inicio", calendar: "Calendario", guests: "Huéspedes", portals: "Portales", reports: "Informes", cleaning: "Limpieza" },
    roles: { owner: "Propietario", manager: "Gestor", family: "Familia", cleaner: "Limpieza" },
    navLabel: "Navegación principal móvil",
    familyRevenue: "Ingresos",
    locked: "No disponible para este rol",
  },
  hr: {
    title: "Poslovanje",
    nav: { start: "Početna", calendar: "Kalendar", guests: "Gosti", portals: "Portali", reports: "Izvješća", cleaning: "Čišćenje" },
    roles: { owner: "Vlasnik", manager: "Upravitelj", family: "Obitelj", cleaner: "Čistač/ica" },
    navLabel: "Glavna mobilna navigacija",
    familyRevenue: "Prihod",
    locked: "Nije dostupno za ovu ulogu",
  },
};

// Tailwind only ships the column counts it can see in the source, so the
// bar picks from a written-out map instead of building the class name.
const NAV_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export function MobileShell({
  data,
  locale,
  children,
}: {
  data: MobileOperationsData | MobileCleaningData;
  locale: Locale;
  children: React.ReactNode;
}) {
  const copy = resolveCopy(COPY, locale);
  // Family gets four big tabs: who comes when, the guests and the revenue.
  // No portal wiring, and cleaning stays reachable but out of the bar.
  const isFamily = data.access === "family";
  const navigation = isFamily
    ? NAVIGATION.filter((item) => item.section !== "portals" && item.section !== "cleaning")
    : NAVIGATION;
  const navLabelFor = (section: MobileSection) =>
    isFamily && section === "reports" ? copy.familyRevenue : copy.nav[section];
  const columns = NAV_COLUMNS[navigation.length] ?? "grid-cols-5";
  return (
    <div className="zf-brand min-h-dvh overflow-x-hidden bg-[var(--zf-bg)] text-[var(--zf-text)]">
      {/* Family is often an older relative on a phone: scale the rem-based
          type and spacing up so everything reads without zooming. */}
      {isFamily && <style>{"html{font-size:112.5%}"}</style>}
      <header className="sticky top-0 z-30 border-b border-[var(--zf-border)] bg-[var(--zf-bg)]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--zf-brand)]">Zelic Family Vir</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{copy.title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <MobileLanguageSwitcher defaultLocale={data.access === "family" ? "hr" : undefined} />
              <span className="shrink-0 rounded-full border border-[var(--zf-brand-line)] bg-[var(--zf-brand-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--zf-brand-dark)]">
                {copy.roles[data.access]}
              </span>
            </div>
          </div>
          <p className="truncate text-sm text-[var(--zf-text-muted)]">{data.selectedProperty.name}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-7">
        {children}
      </main>

      <nav
        aria-label={copy.navLabel}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--zf-border)] bg-[var(--zf-bg)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-24px_rgba(63,23,53,.35)] backdrop-blur"
      >
        <div className={`mx-auto grid max-w-xl ${columns} px-2 py-1.5`}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = data.section === item.section;
            const locked = !canAccessMobileSection(data.access, item.section);
            const content = (
              <>
                <span className={`relative flex h-7 w-full max-w-12 items-center justify-center rounded-full ${active ? "bg-[var(--zf-brand-soft)] text-[var(--zf-brand)]" : "text-[var(--zf-text-muted)]"}`}>
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.9} />
                  {locked && <LockKeyhole aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3" />}
                </span>
                <span className={`w-full truncate px-0.5 text-center font-medium ${isFamily ? "text-sm" : "text-[11px]"}`}>{navLabelFor(item.section)}</span>
              </>
            );
            const className = `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] ${active ? "text-[var(--zf-brand)]" : "text-[var(--zf-text-muted)]"} ${locked ? "cursor-not-allowed opacity-55" : "hover:bg-[var(--zf-surface)]"}`;
            return locked ? (
              <span key={item.section} className={className} aria-disabled="true" title={copy.locked}>
                {content}
              </span>
            ) : (
              <Link key={item.section} href={item.href} className={className} aria-current={active ? "page" : undefined}>
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
