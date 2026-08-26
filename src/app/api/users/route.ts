import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireSuperadmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkPasswordStrength } from "@/lib/security/password-strength";

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireSuperadmin();
    if (response) return response;

    const role = request.nextUrl.searchParams.get("role");
    const where = role ? { role } : {};

    const users = await prisma.user.findMany({
      where,
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSuperadmin();
    if (response) return response;

    const { username, password } = await request.json();
    if (!username?.trim() || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }
    if (typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
    const strength = checkPasswordStrength(password, username.trim());
    if (!strength.ok) {
      return NextResponse.json({ error: strength.reason }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        role: "user",
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    await logAudit(session.userId, "create", "user", user.id, {
      username: user.username,
      role: user.role,
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
