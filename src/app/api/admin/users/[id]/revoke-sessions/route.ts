import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Superadmin emergency action: invalidate every JWT for one account. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    if (userId === auth.session.userId) {
      return NextResponse.json(
        { error: "Use logout-all to revoke your own sessions" },
        { status: 400 },
      );
    }

    const result = await prisma.user.updateMany({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
    if (result.count !== 1) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logAudit(auth.session.userId, "update", "user", userId, {
      sessionsRevoked: true,
      actor: "superadmin",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
