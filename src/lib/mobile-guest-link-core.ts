/**
 * What the pre-arrival link is doing right now, phrased as one state the
 * phone can act on. The desktop reservation view spreads this across a
 * status badge, an expiry line and a disabled button; on a phone the host
 * needs the single answer: can I still send this to the guest?
 */

export interface MobileGuestLinkSubmission {
  shareUrl: string | null;
  status?: string | null;
  submittedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export type MobileGuestLinkState =
  | "none"
  | "waiting"
  | "submitted"
  | "expired"
  | "revoked"
  | "unavailable";

export interface MobileGuestLink {
  state: MobileGuestLinkState;
  /** True only when there is a usable URL the guest could still open. */
  canShare: boolean;
}

export function describeGuestLink(
  submission: MobileGuestLinkSubmission | null,
  now: string,
): MobileGuestLink {
  if (!submission) return { state: "none", canShare: false };
  if (submission.revokedAt) return { state: "revoked", canShare: false };
  if (submission.submittedAt) return { state: "submitted", canShare: false };
  if (submission.expiresAt && submission.expiresAt <= now) {
    return { state: "expired", canShare: false };
  }
  // An older submission can exist whose token this account cannot read
  // back — sharing a link we do not have would be a lie.
  if (!submission.shareUrl) return { state: "unavailable", canShare: false };
  return { state: "waiting", canShare: true };
}
