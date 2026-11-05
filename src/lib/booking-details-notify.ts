/**
 * Tells the host by email when a new Booking.com or Airbnb stay arrives over
 * iCal. The feed carries only dates, so the mail says which details to add
 * and links straight to the open items on the phone.
 *
 * Best effort: a failed or unconfigured mail never fails the sync.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { configuredPublicOrigin } from "@/lib/public-origin";
import { isPortalBookingEvent } from "@/lib/booking-details-gaps";

export interface NewStay {
  platform: string;
  summary: string;
  startDate: string;
  endDate: string;
}

const PLATFORM_LABEL: Record<string, string> = { booking: "Booking.com", airbnb: "Airbnb" };

function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Which new feed events deserve a mail: upcoming guest stays, not blocks. */
export function staysWorthMailing(events: NewStay[], today: string): NewStay[] {
  return events.filter((event) => event.startDate >= today && isPortalBookingEvent(event));
}

export function buildNewStayEmail(input: {
  propertyName: string;
  stays: NewStay[];
  origin: string | null;
}): { subject: string; text: string; html: string } {
  const lines = input.stays.map(
    (stay) => `${dayLabel(stay.startDate)}–${dayLabel(stay.endDate)} · ${PLATFORM_LABEL[stay.platform.toLowerCase()] ?? stay.platform}`,
  );
  const link = input.origin ? `${input.origin}/mobile` : null;
  const subject =
    input.stays.length === 1
      ? `Neue Buchung ${lines[0]} – Name, Betrag und Gäste fehlen`
      : `${input.stays.length} neue Buchungen – Name, Betrag und Gäste fehlen`;
  const intro = `${input.propertyName}: Booking.com und Airbnb schicken nur die Daten. Bitte Name, Betrag und Gäste eintragen, damit die Buchung in Gästeliste und Berichten zählt.`;
  const text = [intro, "", ...lines.map((line) => `• ${line}`), "", link ? `Eintragen: ${link}` : "In RentTools unter „Offene Punkte“ eintragen."].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f1720">
<p>${escapeHtml(intro)}</p>
<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
${link ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#4a1f3d;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Jetzt eintragen</a></p>` : "<p>In RentTools unter „Offene Punkte“ eintragen.</p>"}
</div>`;
  return { subject, text, html };
}

/** Mails the property owner about new portal stays found by one sync pass. */
export async function notifyNewPortalStays(input: {
  propertyId: number;
  propertyName: string;
  events: NewStay[];
  today: string;
}): Promise<boolean> {
  const stays = staysWorthMailing(input.events, input.today);
  if (stays.length === 0) return false;
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { user: { select: { email: true } } },
  });
  const to = property?.user?.email;
  if (!to) return false;
  const mail = buildNewStayEmail({
    propertyName: input.propertyName,
    stays,
    origin: configuredPublicOrigin(),
  });
  const result = await sendEmail({ to, ...mail });
  return result.ok;
}
