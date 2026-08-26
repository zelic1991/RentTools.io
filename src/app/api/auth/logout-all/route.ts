import { NextResponse } from "next/server";
import { clearSessionCookies, getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Revoke every current session for the signed-in account, including this one. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    await clearSessionCookies();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.impersonatorId) {
    return NextResponse.json(
      { error: "Exit impersonation before revoking sessions" },
      { status: 403 },
    );
  }

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { sessionVersion: { increment: 1 } },
    });
    await logAudit(session.userId, "update", "user", session.userId, {
      sessionsRevoked: true,
      actor: "self",
    });
    await clearSessionCookies();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
