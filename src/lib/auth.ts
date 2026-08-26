import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me"
);

const COOKIE_NAME = "rent-tool-session";
// Side cookie that holds the superadmin's ORIGINAL session JWT while
// they're impersonating another user. The /api/admin/exit-impersonation
// route reads this and restores it onto the main session cookie. Kept
// separate so a session JWT swap (login as the target user) doesn't
// lose the admin's own creds.
const IMPERSONATOR_COOKIE_NAME = "rent-tool-impersonator-session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number, username: string, role: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true, suspendedAt: true },
  });
  if (!user || user.suspendedAt) {
    throw new Error("Cannot create a session for a missing or suspended user");
  }

  const token = await new SignJWT({
    userId,
    username,
    role,
    sessionVersion: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return token;
}

/**
 * Mint a short-lived impersonation session for a superadmin. The
 * resulting JWT identifies as the TARGET user (so every downstream
 * permission check sees them as that user and renders their data)
 * while carrying the impersonator's id+username so the banner +
 * audit log can show who's actually driving.
 *
 * Shorter expiry (30 min) than a normal session — impersonation is a
 * support-window activity, not a long-lived login. If the admin walks
 * away from the keyboard the token expires before someone can hijack.
 */
export async function createImpersonationSession(
  targetUserId: number,
  targetUsername: string,
  targetRole: string,
  impersonatorId: number,
  impersonatorUsername: string,
  targetSessionVersion: number,
  impersonatorSessionVersion: number,
): Promise<string> {
  return await new SignJWT({
    userId: targetUserId,
    username: targetUsername,
    role: targetRole,
    impersonatorId,
    impersonatorUsername,
    sessionVersion: targetSessionVersion,
    impersonatorSessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m")
    .sign(SECRET);
}

export async function setSessionCookie(token: string, maxAgeSeconds: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export async function setImpersonatorCookie(adminToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATOR_COOKIE_NAME, adminToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 30, // 30 min — matches the impersonation token's life
    path: "/",
  });
}

export async function readImpersonatorCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value ?? null;
}

export async function clearImpersonatorCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATOR_COOKIE_NAME);
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(IMPERSONATOR_COOKIE_NAME);
}

export async function readCurrentSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

// React's `cache()` wraps the resolver in per-request memoization. The
// root layout calls getSession() to populate SessionProvider, then the
// home page calls it again to redirect logged-in users, then the
// dashboard layout calls it again to gate access — without `cache()`
// we'd hit Prisma three times for the same request. With it, every
// caller within a single request shares the same result, and the DB
// is hit at most once. (This is React's request-scoped cache, not
// Next.js's data-cache — different mechanism, no revalidation needed.)
export const getSession = cache(_getSession);

async function _getSession(): Promise<{
  userId: number;
  username: string;
  role: string;
  sessionVersion: number;
  /** Set when the current session is a superadmin impersonating
   *  another user. The session.userId is the TARGET user (so render
   *  + permission checks see them as that user); impersonatorId is
   *  the admin who started the session. The banner reads this; audit
   *  log writers include it on every action so the paper trail
   *  records who was actually driving the click. */
  impersonatorId?: number;
  impersonatorUsername?: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const session = await validateSessionToken(token);
    if (!session) {
      try {
        cookieStore.delete(COOKIE_NAME);
        cookieStore.delete(IMPERSONATOR_COOKIE_NAME);
      } catch {}
    }
    return session;
  } catch {
    return null;
  }
}

export type Session = {
  userId: number;
  username: string;
  role: string;
  sessionVersion: number;
  impersonatorId?: number;
  impersonatorUsername?: string;
  impersonatorSessionVersion?: number;
};

/** Validate both JWT integrity and the current database authority version. */
export async function validateSessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const session = payload as Partial<Session>;
    if (
      !Number.isInteger(session.userId) ||
      !Number.isInteger(session.sessionVersion) ||
      typeof session.username !== "string" ||
      typeof session.role !== "string"
    ) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { username: true, role: true, suspendedAt: true, sessionVersion: true },
    });
    if (
      !user ||
      user.suspendedAt ||
      user.sessionVersion !== session.sessionVersion
    ) {
      return null;
    }

    session.username = user.username;
    session.role = user.role;

    if (session.impersonatorId !== undefined) {
      if (
        !Number.isInteger(session.impersonatorId) ||
        !Number.isInteger(session.impersonatorSessionVersion)
      ) {
        return null;
      }
      const impersonator = await prisma.user.findUnique({
        where: { id: session.impersonatorId },
        select: { username: true, role: true, suspendedAt: true, sessionVersion: true },
      });
      if (
        !impersonator ||
        impersonator.suspendedAt ||
        impersonator.role !== "superadmin" ||
        impersonator.sessionVersion !== session.impersonatorSessionVersion
      ) {
        return null;
      }
      session.impersonatorUsername = impersonator.username;
    }

    return session as Session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await clearSessionCookies();
}

export type RequireSuperadminResult =
  | { session: Session; response: null }
  | { session: null; response: NextResponse };

export async function requireSuperadmin(): Promise<RequireSuperadminResult> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.role !== "superadmin") {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, response: null };
}
