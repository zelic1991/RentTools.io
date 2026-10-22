"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { SUPPORTED_LOCALES } from "@/lib/i18n/alternates";
import { isLocale, readLocaleCookieFromDocument } from "@/lib/i18n/cookie";
import { resolveCopy, type CopyMap, type Locale } from "@/lib/i18n/translations";

const LABEL: CopyMap<string> = {
  en: "Language",
  ru: "Язык",
  de: "Sprache",
  fr: "Langue",
  es: "Idioma",
  hr: "Jezik",
};

/**
 * The phone surface has no footer, so this is the only place a family
 * member can change language there. It sets the locale exactly like the
 * dashboard's language buttons (`setLocale` writes the rt-locale cookie),
 * then refreshes so the server-rendered screens re-render in the new
 * language too. A native select keeps it small in the header and opens
 * the phone's own large picker.
 *
 * `defaultLocale` applies once on a device that never chose a language
 * (no rt-locale cookie), so a family member lands in their language
 * instead of the app-wide English default. An explicit choice wins.
 */
export function MobileLanguageSwitcher({ defaultLocale }: { defaultLocale?: Locale }) {
  const router = useRouter();
  const { locale, setLocale } = useI18n();
  const [pending, startTransition] = useTransition();
  const label = resolveCopy(LABEL, locale);

  useEffect(() => {
    if (!defaultLocale || defaultLocale === locale) return;
    if (readLocaleCookieFromDocument(document) !== null) return;
    setLocale(defaultLocale);
    startTransition(() => router.refresh());
  }, [defaultLocale, locale, setLocale, router]);

  return (
    <label className="relative flex h-11 shrink-0 items-center gap-1 rounded-full border border-[var(--zf-border)] bg-[var(--zf-bg)] pl-2.5 pr-1 text-[11px] font-semibold text-[var(--zf-text-muted)] focus-within:ring-2 focus-within:ring-[var(--zf-brand)]">
      <Languages aria-hidden className="h-4 w-4" />
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        disabled={pending}
        aria-label={label}
        onChange={(event) => {
          const next = event.target.value;
          if (!isLocale(next) || next === locale) return;
          setLocale(next);
          startTransition(() => router.refresh());
        }}
        className="h-11 min-w-11 cursor-pointer appearance-none bg-transparent pr-1.5 text-[11px] font-semibold uppercase text-[var(--zf-text)] outline-none disabled:opacity-60"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
