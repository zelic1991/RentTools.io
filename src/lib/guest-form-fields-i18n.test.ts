import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("inflects the guest count, one language at a time", () => {
    // The live form read "Ova je rezervacija za 2 osoba" until a smoke
    // test on a real share link showed it. Three different rules, and
    // 21/22 is where they part company - so every one is spelled out.
    const at = (loc: "hr" | "pl" | "cs" | "sk" | "de" | "fr" | "es", n: number) =>
      GUEST_FIELD_COPY[loc].travelersFor(n).trim();

    // Croatian: last digit decides, teens excepted. 21 goes back to the
    // singular, 22 to the paucal.
    expect(at("hr", 1)).toBe("Ova je rezervacija za 1 osobu.");
    expect(at("hr", 2)).toBe("Ova je rezervacija za 2 osobe.");
    expect(at("hr", 5)).toBe("Ova je rezervacija za 5 osoba.");
    expect(at("hr", 11)).toBe("Ova je rezervacija za 11 osoba.");
    expect(at("hr", 21)).toBe("Ova je rezervacija za 21 osobu.");
    expect(at("hr", 22)).toBe("Ova je rezervacija za 22 osobe.");

    // Polish: "dla" governs the genitive, so there is no paucal at all
    // and no ends-in-digit rule. Only one is different.
    expect(at("pl", 1)).toBe("Ta rezerwacja jest dla 1 osoby.");
    expect(at("pl", 2)).toBe("Ta rezerwacja jest dla 2 osób.");
    expect(at("pl", 5)).toBe("Ta rezerwacja jest dla 5 osób.");
    expect(at("pl", 11)).toBe("Ta rezerwacja jest dla 11 osób.");
    expect(at("pl", 21)).toBe("Ta rezerwacja jest dla 21 osób.");
    expect(at("pl", 22)).toBe("Ta rezerwacja jest dla 22 osób.");

    // Czech: 1 / 2-4 / rest, and 21 stays with the rest.
    expect(at("cs", 1)).toBe("Tato rezervace je pro 1 osobu.");
    expect(at("cs", 2)).toBe("Tato rezervace je pro 2 osoby.");
    expect(at("cs", 5)).toBe("Tato rezervace je pro 5 osob.");
    expect(at("cs", 11)).toBe("Tato rezervace je pro 11 osob.");
    expect(at("cs", 21)).toBe("Tato rezervace je pro 21 osob.");
    expect(at("cs", 22)).toBe("Tato rezervace je pro 22 osob.");

    // Slovak: same rule, different genitive plural.
    expect(at("sk", 1)).toBe("Táto rezervácia je pre 1 osobu.");
    expect(at("sk", 2)).toBe("Táto rezervácia je pre 2 osoby.");
    expect(at("sk", 5)).toBe("Táto rezervácia je pre 5 osôb.");
    expect(at("sk", 11)).toBe("Táto rezervácia je pre 11 osôb.");
    expect(at("sk", 21)).toBe("Táto rezervácia je pre 21 osôb.");
    expect(at("sk", 22)).toBe("Táto rezervácia je pre 22 osôb.");

    // The three that only need singular versus plural.
    expect(at("de", 1)).toBe("Diese Buchung ist für 1 Person.");
    expect(at("de", 3)).toBe("Diese Buchung ist für 3 Personen.");
    expect(at("fr", 1)).toBe("Cette réservation est pour 1 personne.");
    expect(at("es", 1)).toBe("Esta reserva es para 1 persona.");
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
      expect(c.greeting("Ana").trim(), locale).not.toBe("");
      expect(c.privacy.title.trim(), locale).not.toBe("");
      expect(c.privacy.summary.trim(), locale).not.toBe("");
      expect(c.privacy.bullets.length, locale).toBe(GUEST_UI_COPY.en.privacy.bullets.length);
      for (const bullet of c.privacy.bullets) {
        expect(bullet.title.trim(), locale).not.toBe("");
        expect(bullet.body.trim(), locale).not.toBe("");
      }
    }
  });

  it("only puts the guest's name in a greeting the language can inflect", () => {
    // Croatian, Polish and Czech decline a name in direct address, and
    // Croatian also marks gender ("Poštovani Ana" is wrong for a woman).
    // A stored booking name carries neither, so those greet without it
    // rather than guess. Hungarian "Kedves Ana" needs no inflection.
    for (const locale of ["en", "ru", "de", "fr", "es", "hu"] as const) {
      expect(GUEST_UI_COPY[locale].greeting("Ana"), locale).toContain("Ana");
    }
    for (const locale of ["hr", "pl", "cs", "sk"] as const) {
      expect(GUEST_UI_COPY[locale].greeting("Ana"), locale).not.toContain("Ana");
    }
  });

  it("says plainly that support cannot read identity data while impersonating", () => {
    // The claim is a security promise; "help mode" does not carry it.
    for (const locale of GUEST_FORM_LOCALES) {
      const whoSees = GUEST_UI_COPY[locale].privacy.bullets[0].body;
      expect(whoSees.length, locale).toBeGreaterThan(120);
      expect(whoSees, locale).toMatch(/RentTools/);
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

/**
 * The tests above prove the translations exist. They cannot prove the
 * component uses them — and that is exactly how "Border entry place"
 * and "Border entry point" shipped in English with a full set of
 * translations sitting unused next to them, under a green suite.
 *
 * These read the consumer's source instead.
 */
describe("the guest form actually consumes the translations", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/components/guest-form-filler.tsx"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("references every field-copy key", () => {
    for (const key of KEYS) {
      expect(source, `fc.${key} is never rendered`).toContain(`fc.${key}`);
    }
  });

  it("references the link-state messages", () => {
    for (const key of ["linkSecurityError", "linkStorageError", "linkInactive"] as const) {
      expect(source, `copy.${key} is never rendered`).toContain(`copy.${key}`);
    }
  });

  it("leaves no English field label hardcoded in the markup", () => {
    for (const key of KEYS) {
      const value = GUEST_FIELD_COPY.en[key];
      if (typeof value !== "string" || value.length < 4) continue;
      expect(source, `"${value}" is hardcoded instead of using fc.${key}`)
        .not.toContain(`>${value}<`);
      expect(source, `"${value}" is hardcoded instead of using fc.${key}`)
        .not.toContain(`"${value}"`);
    }
  });
});
