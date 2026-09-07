import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { consumeMagicToken } from "@/lib/magic-login";
import { isLocale, LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const locale = request.nextUrl.searchParams.get("locale");
  try {
    if (!token || token.length > 512) throw new Error("INVALID_MAGIC_LINK");
    const user = await consumeMagicToken(token);
    await createSession(user.id, user.username, user.role);
    // Relative Location on purpose: the browser resolves it against the
    // public URL it opened, so no proxy hop can turn it into localhost.
    const res = new NextResponse(null, { status: 307, headers: { Location: "/dashboard" } });
    // The link was minted for its holder, not for the admin who made it:
    // land them in their own language straight away.
    if (isLocale(locale)) {
      res.cookies.set(LOCALE_COOKIE_NAME, locale, {
        maxAge: LOCALE_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  } catch {
    return new NextResponse(null, { status: 307, headers: { Location: "/login?error=magic_link_invalid" } });
  }
}
