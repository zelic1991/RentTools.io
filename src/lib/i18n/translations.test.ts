import { describe, expect, it } from "vitest";
import { LOCALE_FALLBACK, resolveCopy, translations, type CopyMap, type Locale } from "./translations";

describe("resolveCopy", () => {
  const table: CopyMap<string> = { en: "Save", de: "Speichern" };

  it("returns the requested locale when it is there", () => {
    expect(resolveCopy({ ...table, hr: "Spremi" }, "hr")).toBe("Spremi");
    expect(resolveCopy(table, "de")).toBe("Speichern");
  });

  it("sends Croatian to German before English", () => {
    expect(resolveCopy(table, "hr")).toBe("Speichern");
  });

  it("ends at English when the chain runs dry", () => {
    expect(resolveCopy({ en: "Save" }, "hr")).toBe("Save");
    expect(resolveCopy(table, "fr")).toBe("Save");
    expect(resolveCopy(table, "en")).toBe("Save");
  });

  it("treats an empty string as missing", () => {
    expect(resolveCopy({ en: "Save", de: "" }, "hr")).toBe("Save");
  });

  it("works for object tables and function tables", () => {
    const objects = { en: { label: "Night" }, de: { label: "Nacht" } };
    expect(resolveCopy(objects, "hr").label).toBe("Nacht");
    const fns: CopyMap<(n: number) => string> = { en: (n) => `${n} nights`, de: (n) => `${n} Naechte` };
    expect(resolveCopy(fns, "hr")(3)).toBe("3 Naechte");
  });

  it("never loops on a cyclic fallback table", () => {
    const original = { ...LOCALE_FALLBACK };
    try {
      (LOCALE_FALLBACK as Record<string, Locale>).hr = "de";
      (LOCALE_FALLBACK as Record<string, Locale>).de = "hr";
      expect(resolveCopy({ en: "Save" }, "hr")).toBe("Save");
    } finally {
      for (const k of Object.keys(LOCALE_FALLBACK)) delete (LOCALE_FALLBACK as Record<string, Locale>)[k];
      Object.assign(LOCALE_FALLBACK, original);
    }
  });
});

describe("translations", () => {
  it("carries English for every key", () => {
    for (const [key, entry] of Object.entries(translations)) {
      expect(entry.en, key).toBeTruthy();
    }
  });

  it("shows German, never English, where Croatian is still missing", () => {
    let checked = 0;
    for (const [key, entry] of Object.entries(translations)) {
      const e = entry as CopyMap<string>;
      if (e.hr === undefined && e.de !== undefined) {
        expect(resolveCopy(e, "hr"), key).toBe(e.de);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
