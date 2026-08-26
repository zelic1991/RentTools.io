import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createMagicToken } from "@/lib/magic-login";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, session } = await requireSuperadmin();
  if (response) return response;
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Unable to create link" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, suspendedAt: true } });
    if (!user || user.suspendedAt || user.role === "superadmin" || user.id === session.userId) {
      return NextResponse.json({ error: "Unable to create link" }, { status: 400 });
    }
    const created = createMagicToken();
    await prisma.magicLoginToken.create({ data: { tokenHash: created.tokenHash, userId: user.id, expiresAt: created.expiresAt } });
    await logAudit(session.userId, "create", "user", user.id, { action: "magic_login_link", role: user.role });
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    return NextResponse.json({ url: `${base}/login/magic?token=${encodeURIComponent(created.token)}`, expiresAt: created.expiresAt.toISOString() });
  } catch (error) {
    console.error("Magic link creation failed", error);
    return NextResponse.json({ error: "Unable to create link" }, { status: 500 });
  }
}
