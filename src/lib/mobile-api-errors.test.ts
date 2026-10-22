import { describe, expect, it } from "vitest";
import { germanApiError, localizedApiError } from "@/lib/mobile-api-errors";

describe("localized api errors", () => {
  it("answers in the user's language", () => {
    expect(localizedApiError("Overlapping reservation exists", "hr", "x")).toBe(
      "Ti su dani već zauzeti drugom rezervacijom.",
    );
    expect(localizedApiError("Overlapping reservation exists", "en", "x")).toBe(
      "These days are already taken by another booking.",
    );
    expect(localizedApiError("Overlapping reservation exists", "de", "x")).toBe(
      germanApiError("Overlapping reservation exists", "x"),
    );
  });

  it("passes unknown and prototype-named messages through", () => {
    expect(localizedApiError("constructor", "fr", "x")).toBe("constructor");
    expect(localizedApiError(undefined, "ru", "fallback")).toBe("fallback");
  });
});

describe("german api errors", () => {
  it("translates the answers a host actually runs into", () => {
    expect(germanApiError("Overlapping reservation exists", "x")).toBe(
      "Diese Tage sind schon durch eine andere Buchung belegt.",
    );
    expect(germanApiError("Reservation dates are outside the owner calendar window", "x")).toBe(
      "Diese Tage liegen außerhalb des Buchungsfensters.",
    );
    expect(germanApiError("bookedGuestCount must be an integer from 1 to 50", "x")).toBe(
      "Gästezahl muss eine ganze Zahl zwischen 1 und 50 sein.",
    );
  });

  it("passes an unknown message through rather than inventing one", () => {
    // A wrong German sentence hides what happened; the English original
    // at least matches what the server said.
    expect(germanApiError("Linked booking relationship cannot be changed", "x")).toBe(
      "Linked booking relationship cannot be changed",
    );
  });

  it("falls back when the body carried no message", () => {
    for (const value of [undefined, null, 42, "", "   ", {}]) {
      expect(germanApiError(value, "Das hat nicht geklappt.")).toBe("Das hat nicht geklappt.");
    }
  });
});
