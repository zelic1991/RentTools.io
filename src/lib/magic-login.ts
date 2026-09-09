import { createHash, randomBytes } from "node:crypto";

export const MAGIC_LINK_TTL_MS = 30 * 60 * 1000;

/**
 * A family link stays valid for a year and may be used again and
 * again: the holder taps it whenever their 7-day session has lapsed.
 * A year means a relative gets one link and never has to ask for
 * another; the trade-off is that a leaked link stays useful that long,
 * which is what the revoke endpoint is for.
 * It is a bearer credential - anyone holding it signs in as that user -
 * so the admin route only mints it for ordinary accounts, never for a
 * superadmin, and it can be revoked at any time.
 */
export const FAMILY_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export type MagicLinkKind = "once" | "family";

export function ttlForKind(kind: MagicLinkKind): number {
  return kind === "family" ? FAMILY_LINK_TTL_MS : MAGIC_LINK_TTL_MS;
}

export function hashMagicToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createMagicToken(now = new Date(), ttlMs = MAGIC_LINK_TTL_MS) {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashMagicToken(token), expiresAt: new Date(now.getTime() + ttlMs) };
}

/** The URL a holder opens. `locale` is applied on redemption so the
 *  recipient lands in their own language, not the admin's. */
export function magicLinkUrl(base: string, token: string, locale?: string | null): string {
  const url = `${base.replace(/\/$/, "")}/login/magic?token=${encodeURIComponent(token)}`;
  return locale ? `${url}&locale=${encodeURIComponent(locale)}` : url;
}

export async function consumeMagicToken(token: string) {
  const { prisma } = await import("@/lib/prisma");
  const tokenHash = hashMagicToken(token);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const row = await tx.magicLoginToken.findUnique({ where: { tokenHash } });
    if (!row || row.expiresAt <= now) throw new Error("INVALID_MAGIC_LINK");
    const reusable = row.kind === "family";
    if (!reusable && row.usedAt) throw new Error("INVALID_MAGIC_LINK");
    const user = await tx.user.findUnique({ where: { id: row.userId }, select: { id: true, username: true, role: true, suspendedAt: true } });
    if (!user || user.suspendedAt) throw new Error("INVALID_MAGIC_LINK");
    if (reusable) {
      await tx.magicLoginToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
    } else {
      const consumed = await tx.magicLoginToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (consumed.count !== 1) throw new Error("INVALID_MAGIC_LINK");
    }
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    return user;
  });
}
