import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptGuestData, hashShareToken } from "@/lib/precheckin-crypto";

export function mintGuestFormToken(): string {
  return randomBytes(32).toString("base64url");
}

export function guestFormExpiry(checkOut: Date): Date {
  const expiry = new Date(checkOut);
  expiry.setUTCDate(expiry.getUTCDate() + 1);
  expiry.setUTCHours(23, 59, 59, 999);
  return expiry;
}

export async function findSubmissionByPublicToken(token: string) {
  if (!token || token.length < 32 || token.length > 180) return null;
  const tokenHash = hashShareToken(token);
  const hardened = await prisma.guestFormSubmission.findUnique({
    where: { tokenHash },
    include: {
      template: true,
      reservation: {
        include: { property: { select: { id: true, name: true, feedToken: true } } },
      },
    },
  });
  if (hardened) return hardened;

  // Existing links issued before token hashing remain usable until their owner
  // rotates or revokes them. New links never enter this fallback path.
  return prisma.guestFormSubmission.findUnique({
    where: { shareToken: token },
    include: {
      template: true,
      reservation: {
        include: { property: { select: { id: true, name: true, feedToken: true } } },
      },
    },
  });
}

export function publicSubmissionState(submission: {
  revokedAt: Date | null;
  expiresAt: Date | null;
  submittedAt: Date | null;
  status: string;
}): "active" | "revoked" | "expired" | "submitted" {
  if (submission.revokedAt || submission.status === "REVOKED") return "revoked";
  if (submission.expiresAt && submission.expiresAt.getTime() < Date.now()) return "expired";
  if (submission.submittedAt || submission.status === "OWNER_REVIEW_REQUIRED" || submission.status === "OWNER_APPROVED") {
    return "submitted";
  }
  return "active";
}

export function decryptOwnerShareToken(tokenCiphertext: string | null): string | null {
  if (!tokenCiphertext) return null;
  try {
    const value = decryptGuestData<{ token: string }>(tokenCiphertext);
    return typeof value.token === "string" ? value.token : null;
  } catch {
    return null;
  }
}

export function sameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Browser writes to a bearer-token URL must carry an Origin header. A
  // missing/opaque origin is not treated as same-origin: accepting it would
  // make the protection disappear for malformed proxy traffic and non-browser
  // replays.
  if (!origin || origin === "null") return false;
  try {
    const received = new URL(origin);
    const configured = process.env.PUBLIC_APP_URL?.trim();
    const expected = configured ? new URL(configured) : new URL(request.url);

    // Production needs a stable canonical origin. Deriving trust from Host or
    // X-Forwarded-Host lets a client-controlled header redefine "same site".
    if (process.env.NODE_ENV === "production") {
      if (!configured || expected.protocol !== "https:" || received.protocol !== "https:") {
        return false;
      }
    }
    return received.origin === expected.origin;
  } catch {
    return false;
  }
}
