import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

const FEED_TOKEN_BYTES = 24;
const FEED_SLUG_MAX_LENGTH = 32;
const FEED_SLUG_ATTEMPTS = 10;

/** Mint an unguessable bearer token for a protected outbound calendar feed. */
export function mintFeedToken(): string {
  return randomBytes(FEED_TOKEN_BYTES).toString("base64url");
}

function feedSlugCandidate(propertyName: string): string {
  const suffix = randomBytes(6).toString("hex");
  const baseLimit = FEED_SLUG_MAX_LENGTH - suffix.length - 1;
  const base = slugify(propertyName).slice(0, baseLimit).replace(/-+$/g, "");
  return `${base || "property"}-${suffix}`;
}

/**
 * Mint a durable slug that is unused by both materialised properties and
 * pre-signup drafts. The database unique constraints remain the final guard
 * against a concurrent collision.
 */
export async function mintUniqueFeedSlug(propertyName: string): Promise<string> {
  for (let attempt = 0; attempt < FEED_SLUG_ATTEMPTS; attempt++) {
    const candidate = feedSlugCandidate(propertyName);
    const [property, draft] = await Promise.all([
      prisma.property.findUnique({ where: { feedSlug: candidate }, select: { id: true } }),
      prisma.onboardingDraft.findUnique({ where: { feedSlug: candidate }, select: { id: true } }),
    ]);
    if (!property && !draft) return candidate;
  }

  throw new Error("Could not mint a unique feed slug");
}

export async function mintNewPropertyFeedIdentity(
  propertyName: string,
): Promise<{ feedToken: string; feedSlug: string }> {
  const feedSlug = await mintUniqueFeedSlug(propertyName);
  return { feedToken: mintFeedToken(), feedSlug };
}

/**
 * Upgrade a cookie-authorized legacy draft without ever serving a public
 * fallback. The conditional update makes concurrent GET/POST/claim requests
 * converge on the first identity written instead of returning competing URLs.
 */
export async function ensureOnboardingDraftFeedIdentity(draft: {
  id: number;
  propertyName: string;
  feedSlug: string | null;
  feedToken: string | null;
}): Promise<{ feedSlug: string; feedToken: string }> {
  if (draft.feedSlug && draft.feedToken) {
    return { feedSlug: draft.feedSlug, feedToken: draft.feedToken };
  }

  const data: { feedSlug?: string; feedToken?: string } = {};
  if (!draft.feedSlug) data.feedSlug = await mintUniqueFeedSlug(draft.propertyName);
  if (!draft.feedToken) data.feedToken = mintFeedToken();

  await prisma.onboardingDraft.updateMany({
    where: {
      id: draft.id,
      ...(!draft.feedSlug ? { feedSlug: null } : {}),
      ...(!draft.feedToken ? { feedToken: null } : {}),
    },
    data,
  });

  const current = await prisma.onboardingDraft.findUnique({
    where: { id: draft.id },
    select: { feedSlug: true, feedToken: true },
  });
  if (!current?.feedSlug || !current.feedToken) {
    throw new Error("Onboarding draft feed identity is unavailable");
  }
  return { feedSlug: current.feedSlug, feedToken: current.feedToken };
}
