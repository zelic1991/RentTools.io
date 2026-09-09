import { describe, expect, it } from "vitest";
import {
  ARRIVAL_ORGANIZATIONS,
  DOCUMENT_TYPES,
  GENDERS,
  SERVICE_TYPES,
} from "@/lib/precheckin";
import { GUEST_FIELD_COPY, type GuestFormFieldCopy } from "./guest-form-fields-i18n";
import { GUEST_FORM_LOCALES, GUEST_UI_COPY, LOCALE_NATIVE_NAME } from "./guest-form-i18n";

/**
 * The guest form is the one surface a stranger fills in under legal
 * obligation, so a missing label is not a cosmetic bug: it is a
 * question nobody can answer. These tests hold every locale to the
 * English entry, key for key.
 */

const KEYS = Object.keys(GUEST_FIELD_COPY.en) as (keyof GuestFormFieldCopy)[];
const NEW_LOCALES = ["hr", "pl", "cs", "sk", "hu"] as const;

describe("guest form field copy", () => {
  it("covers every locale the form offers", () => {
    for (const locale of GUEST_FORM_LOCALES) {
      expect(GUEST_FIELD_COPY[locale], locale).toBeDefined();
      expect(LOCALE_NATIVE_NAME[locale], locale).toBeTruthy();
    }
  });

  it("leaves no key blank in any locale", () => {
    for (const locale of GUEST_FORM_LOCALES) {
      const entry = GUEST_FIELD_COPY[locale];
      for (const key of KEYS) {
        const value = entry[key];
        if (typeof value === "function") continue;
        if (key === "optionLabels") continue;
        expect(String(value).trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("produces real text from the templated labels", () => {
    for (const locale of GUEST_FORM_LOCALES) {
      const c = GUEST_FIELD_COPY[locale];
      expect(c.stayDatesNote("2027-05-10", "2027-05-16"), locale).toContain("2027-05-10");
      expect(c.travelersFor(4), locale).toContain("4");
      expect(c.travelerN(2), locale).toContain("2");
    }
  });

  it("labels every eVisitor option value, so no guest sees a raw code", () => {
    const values = [...GENDERS, ...DOCUMENT_TYPES, ...ARRIVAL_ORGANIZATIONS, ...SERVICE_TYPES];
    for (const locale of GUEST_FORM_LOCALES) {
      for (const value of values) {
        expect(GUEST_FIELD_COPY[locale].optionLabels[value], `${locale}.${value}`).toBeTruthy();
      }
    }
  });

  it("actually translates the new locales rather than copying English", () => {
    // A block pasted from `en` and left alone is the likeliest way this
    // ships broken, and it type-checks perfectly.
    const check: (keyof GuestFormFieldCopy)[] = [
      "stayDetails",
      "travelers",
      "firstName",
      "documentNumber",
      "additionalQuestions",
    ];
    for (const locale of NEW_LOCALES) {
      for (const key of check) {
        expect(GUEST_FIELD_COPY[locale][key], `${locale}.${key}`).not.toBe(
          GUEST_FIELD_COPY.en[key],
        );
      }
    }
  });
});

describe("guest form chrome copy", () => {
  it("covers every locale, privacy panel included", () => {
    for (const locale of GUEST_FORM_LOCALES) {
      const c = GUEST_UI_COPY[locale];
      expect(c, locale).toBeDefined();
      for (const key of ["intro", "titleFallback", "submit", "thanks", "language"] as const) {
        expect(c[key].trim(), `${locale}.${key}`).not.toBe("");
      }
      expect(c.greeting("Ana"), locale).toContain("Ana");
      expect(c.privacy.title.trim(), locale).not.toBe("");
      expect(c.privacy.summary.trim(), locale).not.toBe("");
      expect(c.privacy.bullets.length, locale).toBe(GUEST_UI_COPY.en.privacy.bullets.length);
      for (const bullet of c.privacy.bullets) {
        expect(bullet.title.trim(), locale).not.toBe("");
        expect(bullet.body.trim(), locale).not.toBe("");
      }
    }
  });

  it("translates the privacy notice for the new locales", () => {
    for (const locale of NEW_LOCALES) {
      expect(GUEST_UI_COPY[locale].privacy.summary, locale).not.toBe(
        GUEST_UI_COPY.en.privacy.summary,
      );
      expect(GUEST_UI_COPY[locale].submit, locale).not.toBe(GUEST_UI_COPY.en.submit);
    }
  });
});
