import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSuperadmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/cron-url
 *
 * Returns the full cron URL (with secret) for the current deployment.
 * Used by the Tasks panel to display the URL for external cron services
 * (e.g. cron-job.org). Server-side so the secret never ends up in the
 * client bundle.
 *
 * Auth: platform superadmin only. The response contains the live cron secret.
 */
export async function GET() {
  try {
    const auth = await requireSuperadmin();
    if (auth.response) return auth.response;

    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
      return NextResponse.json({
        url: null,
        configured: false,
        hint: "Set CRON_SECRET in your environment to enable cron URL display.",
      });
    }

    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host = h.get("x-forwarded-host") || h.get("host");
    if (!host) {
      return NextResponse.json({ url: null, configured: true, hint: "No host header" });
    }

    const url = `${proto}://${host}/api/calendar/cron?secret=${encodeURIComponent(secret)}`;
    return NextResponse.json({ url, configured: true });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
