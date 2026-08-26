import Link from "next/link";
import {
  CalendarDays,
  CircleUserRound,
  House,
  LockKeyhole,
  RadioTower,
  Sparkles,
} from "lucide-react";
import type { MobileOperationsData } from "@/lib/mobile-operations";
import type { MobileCleaningData } from "@/lib/mobile-cleaning";
import { canAccessMobileSection, type MobileSection } from "@/lib/mobile-operations-core";

const NAVIGATION: Array<{
  section: MobileSection;
  label: string;
  href: string;
  icon: typeof House;
}> = [
  { section: "start", label: "Start", href: "/mobile", icon: House },
  { section: "calendar", label: "Kalender", href: "/mobile/calendar", icon: CalendarDays },
  { section: "guests", label: "Gäste", href: "/mobile/guests", icon: CircleUserRound },
  { section: "portals", label: "Portale", href: "/mobile/portals", icon: RadioTower },
  { section: "cleaning", label: "Reinigung", href: "/mobile/cleaning", icon: Sparkles },
];

export function MobileShell({
  data,
  children,
}: {
  data: MobileOperationsData | MobileCleaningData;
  children: React.ReactNode;
}) {
  return (
    <div className="zf-brand min-h-dvh overflow-x-hidden bg-[var(--zf-bg)] text-[var(--zf-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--zf-border)] bg-[var(--zf-bg)]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--zf-brand)]">Zelic Family Vir</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">Betrieb</h1>
            </div>
            <span className="shrink-0 rounded-full border border-[var(--zf-brand-line)] bg-[var(--zf-brand-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--zf-brand-dark)]">
              {data.access === "owner" ? "Owner" : data.access === "manager" ? "Manager" : "Cleaner"}
            </span>
          </div>
          <p className="truncate text-sm text-[var(--zf-text-muted)]">{data.selectedProperty.name}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-7">
        {children}
      </main>

      <nav
        aria-label="Mobile Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--zf-border)] bg-[var(--zf-bg)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-24px_rgba(63,23,53,.35)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 px-2 py-1.5">
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const active = data.section === item.section;
            const locked = !canAccessMobileSection(data.access, item.section);
            const content = (
              <>
                <span className={`relative flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-[var(--zf-brand-soft)] text-[var(--zf-brand)]" : "text-[var(--zf-text-muted)]"}`}>
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.9} />
                  {locked && <LockKeyhole aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3" />}
                </span>
                <span className="text-[11px] font-medium">{item.label}</span>
              </>
            );
            const className = `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--zf-brand)] ${active ? "text-[var(--zf-brand)]" : "text-[var(--zf-text-muted)]"} ${locked ? "cursor-not-allowed opacity-55" : "hover:bg-[var(--zf-surface)]"}`;
            return locked ? (
              <span key={item.section} className={className} aria-disabled="true" title="Für diese Rolle nicht freigegeben">
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
