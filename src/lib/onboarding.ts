import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ensureOnboardingDraftFeedIdentity } from "@/lib/feed-identity";
import { normalizeIcalUrl, normalizePlatformSlug } from "@/lib/calendar-link-input";

export const ONBOARD_COOKIE = "rt-onboard-token";

interface DraftLink {
  platform: string;
  customName?: string;
  color?: string;
  icalExportUrl: string;
  lastTestStatus?: "valid" | "invalid";
}

function isLinkArray(value: unknown): value is DraftLink[] {
  return (
    Array.isArray(value) &&
    value.every(
      (l) =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as { platform?: unknown }).platform === "string" &&
        typeof (l as { icalExportUrl?: unknown }).icalExportUrl === "string",
    )
  );
}

function parseLinks(raw: string): DraftLink[] {
  try {
    const parsed = JSON.parse(raw);
    return isLinkArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * If the visitor has an unclaimed onboarding draft cookie, materialise its
 * propertyName + links as a real Property + CalendarLink rows for the user
 * who just signed up (via username/password OR Google). Best-effort: any
 * failure here is logged but doesn't break signup, since the user can
 * re-create the property manually from the dashboard.
 */
export async function claimOnboardingDraft(userId: number): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(ONBOARD_COOKIE)?.value;
    if (!token) return;

    const draft = await prisma.onboardingDraft.findUnique({ where: { sessionToken: token } });
    if (!draft || draft.claimedByUserId) {
      jar.delete(ONBOARD_COOKIE);
      return;
    }

    const parsedLinks = parseLinks(draft.links);
    const propertyName = draft.propertyName.trim() || "My first property";
    const feedIdentity = await ensureOnboardingDraftFeedIdentity({
      ...draft,
      propertyName,
    });

    // Carry the exact protected identity onto the new Property so a URL the
    // visitor already pasted before signup continues to work byte-for-byte.
    const property = await prisma.property.create({
      data: {
        name: propertyName,
        userId,
        minNights: 1,
        ...feedIdentity,
      },
    });
    await logAudit(userId, "create", "property", property.id, { name: property.name, fromOnboarding: true });

    for (const link of parsedLinks) {
      if (!link.icalExportUrl.trim()) continue;
      const platformResult = normalizePlatformSlug(link.platform);
      const urlResult = normalizeIcalUrl(link.icalExportUrl);
      if (!platformResult.ok || !urlResult.ok) continue;
      try {
        const created = await prisma.calendarLink.create({
          data: {
            propertyId: property.id,
            platform: platformResult.platform,
            icalExportUrl: urlResult.url,
            bufferBefore: 0,
            bufferAfter: 0,
          },
        });
        await logAudit(userId, "create", "calendarLink", created.id, {
          platform: platformResult.platform,
          propertyId: property.id,
          fromOnboarding: true,
        });
      } catch {
        // Bad URL or schema-rejected platform — skip but keep the property.
      }
    }

    await prisma.onboardingDraft.update({
      where: { id: draft.id },
      data: { claimedByUserId: userId, claimedAt: new Date() },
    });

    jar.delete(ONBOARD_COOKIE);
  } catch (err) {
    console.error("Onboarding claim failed:", err);
  }
}
