import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { consumeMagicToken } from "@/lib/magic-login";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  try {
    if (!token || token.length > 512) throw new Error("INVALID_MAGIC_LINK");
    const user = await consumeMagicToken(token);
    await createSession(user.id, user.username, user.role);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=magic_link_invalid", request.url));
  }
}
