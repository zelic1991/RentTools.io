import { NextResponse } from "next/server";
import {
  getSession,
  readImpersonatorCookie,
  setSessionCookie,
  clearImpersonatorCookie,
  clearSessionCookies,
  validateSessionToken,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * Exit an impersonation session. Restores the admin's original JWT
 * from the side cookie onto the main session cookie, then clears the
 * side cookie. Called by the banner's "Exit" button.
 *
 * Auth model: the active impersonation token must still validate both
 * target and operator authority, and the parked token must validate as
 * that exact operator's current superadmin session before restoration.
 */
export async function POST() {
  const session = await getSession();
  if (!session?.impersonatorId) {
    return NextResponse.json(
      { error: "Not in an impersonation session" },
      { status: 400 },
    );
  }

  const adminToken = await readImpersonatorCookie();
  if (!adminToken) {
    // The side cookie expired / was cleared before the impersonation
    // session did. Fail safely — clear the impersonation cookie so the
    // user gets redirected to /login on the next request rather than
    // staying stuck in the target user's view forever.
    await clearSessionCookies();
    return NextResponse.json(
      { error: "Original session lost — please log in again" },
      { status: 410 },
    );
  }

  // The parked token must still represent the same active superadmin and
  // the same sessionVersion. A password change/revoke/suspension while the
  // support window is open therefore prevents restoration.
  const adminPayload = await validateSessionToken(adminToken);
  if (
    !adminPayload ||
    adminPayload.impersonatorId !== undefined ||
    adminPayload.userId !== session.impersonatorId ||
    adminPayload.role !== "superadmin"
  ) {
    await clearSessionCookies();
    return NextResponse.json(
      { error: "Original session expired or was revoked — please log in again" },
      { status: 410 },
    );
  }

  // Restore the admin's original session JWT (not a fresh one — that
  // would reset their sliding 7-day expiry).
  await setSessionCookie(adminToken, 60 * 60 * 24 * 7);
  await clearImpersonatorCookie();

  await logAudit(adminPayload.userId, "exit-impersonate", "user", session.userId, {
    impersonator: adminPayload.username,
    target: session.username,
  });

  return NextResponse.json({ ok: true });
}
