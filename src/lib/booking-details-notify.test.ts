import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { buildNewStayEmail, staysWorthMailing } from "./booking-details-notify";

const garda = { platform: "booking", summary: "CLOSED - Not available", startDate: "2027-08-01", endDate: "2027-08-07" };

describe("staysWorthMailing", () => {
  it("keeps upcoming guest stays and drops blocks and past stays", () => {
    const stays = staysWorthMailing(
      [
        garda,
        { platform: "airbnb", summary: "Airbnb (Not available)", startDate: "2027-01-01", endDate: "2027-03-01" },
        { platform: "booking", summary: "Blocked (cleaning)", startDate: "2027-08-07", endDate: "2027-08-08" },
        { ...garda, startDate: "2026-10-01", endDate: "2026-10-03" },
      ],
      "2026-11-05",
    );
    expect(stays).toEqual([garda]);
  });
});

describe("buildNewStayEmail", () => {
  it("names the dates, the portal and what to add, and links to the phone view", () => {
    const mail = buildNewStayEmail({ propertyName: "Zelic Family Vir", stays: [garda], origin: "https://app.example.com" });
    expect(mail.subject).toBe("Neue Buchung 01.08.2027–07.08.2027 · Booking.com – Name, Betrag und Gäste fehlen");
    expect(mail.text).toContain("Eintragen: https://app.example.com/mobile");
    expect(mail.html).toContain('href="https://app.example.com/mobile"');
  });

  it("summarises several stays in the subject", () => {
    const mail = buildNewStayEmail({ propertyName: "X", stays: [garda, { ...garda, startDate: "2027-09-01", endDate: "2027-09-05" }], origin: null });
    expect(mail.subject).toBe("2 neue Buchungen – Name, Betrag und Gäste fehlen");
    expect(mail.html).not.toContain("href");
  });

  it("escapes the property name in the HTML", () => {
    const mail = buildNewStayEmail({ propertyName: "<b>Haus</b>", stays: [garda], origin: null });
    expect(mail.html).toContain("&lt;b&gt;Haus&lt;/b&gt;");
  });
});
