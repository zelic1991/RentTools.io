import type { Locale } from "@/lib/i18n/translations";
import { BCP47_TAG } from "@/lib/i18n/locale-tags";

/**
 * Intl tag for the phone surface (/mobile, /family). German keeps the
 * Austrian tag those screens have always formatted with, so German users
 * see the same dates and amounts as before; every other locale uses the
 * app-wide BCP-47 tag.
 */
export function mobileIntlTag(locale: Locale): string {
  return locale === "de" ? "de-AT" : BCP47_TAG[locale];
}
