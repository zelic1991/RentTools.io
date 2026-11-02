import { SignJWT, type JWTPayload } from "jose";

/**
 * Long-lived sessions are minted only when a family login link is
 * redeemed (see src/app/login/magic/route.ts). They exist so a relative
 * who runs the apartment from a phone taps their link once and stays
 * signed in, instead of being thrown out every 7 days.
 */
export const LONG_LIVED_SESSION_SECONDS = 365 * 24 * 60 * 60;

/** Re-issue at most once a day, so an active phone keeps sliding forward
 *  without a cookie write on every request. */
export const LONG_LIVED_REFRESH_AFTER_SECONDS = 24 * 60 * 60;

/** JWT claim marking a long-lived (family link) session. */
export const LONG_LIVED_CLAIM = "ll";

/**
 * Given a verified session payload, return a fresh token when it is a
 * long-lived session that was issued more than a day ago; otherwise null.
 * Impersonation tokens are never extended. Revocation still works because
 * every request re-checks sessionVersion against the database.
 */
export async function refreshLongLivedToken(
  payload: JWTPayload,
  secret: Uint8Array,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  if (payload[LONG_LIVED_CLAIM] !== true) return null;
  if (payload.impersonatorId !== undefined) return null;
  if (typeof payload.iat !== "number") return null;
  if (nowSeconds - payload.iat < LONG_LIVED_REFRESH_AFTER_SECONDS) return null;

  const { userId, username, role, sessionVersion } = payload;
  if (
    typeof userId !== "number" ||
    typeof username !== "string" ||
    typeof role !== "string" ||
    typeof sessionVersion !== "number"
  ) {
    return null;
  }

  return new SignJWT({ userId, username, role, sessionVersion, [LONG_LIVED_CLAIM]: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + LONG_LIVED_SESSION_SECONDS)
    .sign(secret);
}
