"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useI18n } from "@/lib/i18n/context";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

interface CopyShape {
  cookieNote: string;
  privacy: string;
  blog: string;
  changelog: string;
  terms: string;
  source: string;
  advertise: string;
  needHelp: string;
}

// Brand names stay as they are; only the words get translated.
const COPY: CopyMap<CopyShape> = {
  en: {
    cookieNote: "Essential cookies only — no tracking, no analytics. See",
    privacy: "Privacy",
    blog: "Blog",
    changelog: "Changelog",
    terms: "Terms",
    source: "Source",
    advertise: "Advertise",
    needHelp: "Need help?",
  },
  ru: {
    cookieNote: "Только необходимые cookie — без трекинга и аналитики. См.",
    privacy: "Конфиденциальность",
    blog: "Блог",
    changelog: "Изменения",
    terms: "Условия",
    source: "Исходный код",
    advertise: "Реклама",
    needHelp: "Нужна помощь?",
  },
  de: {
    cookieNote: "Nur notwendige Cookies — kein Tracking, keine Analyse. Siehe",
    privacy: "Datenschutz",
    blog: "Blog",
    changelog: "Änderungen",
    terms: "Nutzungsbedingungen",
    source: "Quellcode",
    advertise: "Werben",
    needHelp: "Brauchen Sie Hilfe?",
  },
  fr: {
    cookieNote: "Cookies essentiels uniquement — aucun suivi, aucune analyse. Voir",
    privacy: "Confidentialité",
    blog: "Blog",
    changelog: "Nouveautés",
    terms: "Conditions",
    source: "Code source",
    advertise: "Publicité",
    needHelp: "Besoin d’aide ?",
  },
  es: {
    cookieNote: "Solo cookies esenciales — sin rastreo ni analítica. Consulta",
    privacy: "Privacidad",
    blog: "Blog",
    changelog: "Novedades",
    terms: "Términos",
    source: "Código fuente",
    advertise: "Publicidad",
    needHelp: "¿Necesita ayuda?",
  },
  hr: {
    cookieNote: "Samo nužni kolačići — bez praćenja i analitike. Vidi",
    privacy: "Privatnost",
    blog: "Blog",
    changelog: "Promjene",
    terms: "Uvjeti",
    source: "Izvorni kod",
    advertise: "Oglašavanje",
    needHelp: "Trebate pomoć?",
  },
};

// Footer for the logged-in app shell — Privacy, Terms, GitHub source, and
// optionally a "Need help?" support email when the admin has set one.
export function SupportFooter() {
  const { locale } = useI18n();
  const t = resolveCopy(COPY, locale);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { support_email?: string } | null) => {
        if (cancelled) return;
        setEmail((data?.support_email ?? "").trim());
      })
      .catch(() => {
        // Silent — only the support email line will be missing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-center text-xs text-[var(--ink-4)]">
      <p className="mb-1.5 text-[11px] text-[var(--ink-4)]">
        {t.cookieNote}{" "}
        <Link href="/privacy" className="underline hover:text-[var(--ink-2)]">{t.privacy}</Link>.
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <span>© 2026 RentTools</span>
        <Link href="/blog" className="hover:text-[var(--ink-2)]">{t.blog}</Link>
        <Link href="/changelog" className="hover:text-[var(--ink-2)]">{t.changelog}</Link>
        <Link href="/privacy" className="hover:text-[var(--ink-2)]">{t.privacy}</Link>
        <Link href="/terms" className="hover:text-[var(--ink-2)]">{t.terms}</Link>
        <a
          href="https://github.com/Gribadan/RentTools.io"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--ink-2)]"
        >
          {t.source}
        </a>
        <a
          href="mailto:support@renttools.io?subject=Advertising%20enquiry"
          className="hover:text-[var(--ink-2)]"
        >
          {t.advertise}
        </a>
        {email && (
          <a href={`mailto:${email}`} className="hover:text-[var(--ink-2)]">
            {t.needHelp} {email}
          </a>
        )}
        <LocaleSwitcher variant="inline" reloadOnChange={false} />
      </nav>
    </div>
  );
}
