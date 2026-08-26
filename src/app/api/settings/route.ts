import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/auth";

export async function GET() {
  try {
    const { response } = await requireSuperadmin();
    if (response) return response;

    const settings = await prisma.appSettings.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return NextResponse.json(map);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { response } = await requireSuperadmin();
    if (response) return response;

    const { key, value } = await request.json();
    if (typeof key !== "string" || !key.trim()) {
      return NextResponse.json({ error: "Key required" }, { status: 400 });
    }
    if (typeof value !== "string") {
      return NextResponse.json({ error: "Value must be a string" }, { status: 400 });
    }

    await prisma.appSettings.upsert({
      where: { key: key.trim() },
      update: { value },
      create: { key: key.trim(), value },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
