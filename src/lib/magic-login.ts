import { createHash, randomBytes } from "node:crypto";

export const MAGIC_LINK_TTL_MS = 30 * 60 * 1000;

export function hashMagicToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createMagicToken(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashMagicToken(token), expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MS) };
}

export async function consumeMagicToken(token: string) {
  const { prisma } = await import("@/lib/prisma");
  const tokenHash = hashMagicToken(token);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const row = await tx.magicLoginToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt <= now) throw new Error("INVALID_MAGIC_LINK");
    const user = await tx.user.findUnique({ where: { id: row.userId }, select: { id: true, username: true, role: true, suspendedAt: true } });
    if (!user || user.suspendedAt) throw new Error("INVALID_MAGIC_LINK");
    const consumed = await tx.magicLoginToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) throw new Error("INVALID_MAGIC_LINK");
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    return user;
  });
}
