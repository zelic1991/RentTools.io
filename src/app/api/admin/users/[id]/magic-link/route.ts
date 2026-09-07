import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isLocale } from "@/lib/i18n/cookie";
import { createMagicToken, magicLinkUrl, ttlForKind, type MagicLinkKind } from "@/lib/magic-login";

async function eligibleUser(id: number, sessionUserId: number) {
  if (!Number.isInteger(id)) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, suspendedAt: true } });
  if (!user || user.suspendedAt || user.role === "superadmin" || user.id === sessionUserId) return null;
  return user;
}

// POST { kind?: "once" | "family", locale?: Locale } - mint a login link.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, session } = await requireSuperadmin();
  if (response) return response;
  try {
    const user = await eligibleUser(Number((await params).id), session.userId);
    if (!user) return NextResponse.json({ error: "Unable to create link" }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const kind: MagicLinkKind = body?.kind === "family" ? "family" : "once";
    const locale = isLocale(body?.locale) ? body.locale : null;
    const created = createMagicToken(new Date(), ttlForKind(kind));
    await prisma.magicLoginToken.create({ data: { tokenHash: created.tokenHash, userId: user.id, expiresAt: created.expiresAt, kind } });
    await logAudit(session.userId, "create", "user", user.id, { action: "magic_login_link", kind, locale, role: user.role });
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    return NextResponse.json({ url: magicLinkUrl(base, created.token, locale), expiresAt: created.expiresAt.toISOString(), kind });
  } catch (error) {
    console.error("Magic link creation failed", error);
    return NextResponse.json({ error: "Unable to create link" }, { status: 500 });
  }
}

// DELETE - revoke every live login link of this user (family and one-time).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, session } = await requireSuperadmin();
  if (response) return response;
  try {
    const user = await eligibleUser(Number((await params).id), session.userId);
    if (!user) return NextResponse.json({ error: "Unable to revoke links" }, { status: 400 });
    const now = new Date();
    const revoked = await prisma.magicLoginToken.updateMany({ where: { userId: user.id, expiresAt: { gt: now } }, data: { expiresAt: now } });
    await logAudit(session.userId, "delete", "user", user.id, { action: "magic_login_link_revoke", count: revoked.count });
    return NextResponse.json({ revoked: revoked.count });
  } catch (error) {
    console.error("Magic link revocation failed", error);
    return NextResponse.json({ error: "Unable to revoke links" }, { status: 500 });
  }
}
