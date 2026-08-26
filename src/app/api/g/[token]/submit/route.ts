import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { encryptGuestData, hashShareToken } from "@/lib/precheckin-crypto";
import { findSubmissionByPublicToken, publicSubmissionState, sameOriginRequest } from "@/lib/guest-form-security";
import { validatePrecheckinPayload } from "@/lib/precheckin";
import { randomUUID } from "node:crypto";

// RT-25.2 — public submit endpoint for the pre-arrival guest form.
// Anyone with the share token can POST once; subsequent POSTs to an
// already-submitted token are rejected so a stale link can't be reused
// by an unintended party. The request is gated by token possession
// only, no auth — that's the whole point of the share link.

interface AnswerOut {
  fieldId: string;
  type: string;
  label: string;
  value: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 32 || token.length > 180) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    if (!sameOriginRequest(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 256_000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const limit = checkRateLimit(`guest-submit:${hashShareToken(token)}:${clientIp(request)}`, 8, 15 * 60);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many attempts" },
        { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
      );
    }

    const submission = await findSubmissionByPublicToken(token);
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!submission.reservation.property.feedToken) {
      return NextResponse.json({ error: "Secure calendar-feed setup is incomplete" }, { status: 503 });
    }
    const state = publicSubmissionState(submission);
    if (state !== "active") {
      return NextResponse.json(
        {
          error: state === "submitted"
            ? "This form has already been submitted."
            : "This link is no longer active.",
        },
        { status: state === "submitted" ? 409 : 410 },
      );
    }

    const body = await request.json().catch(() => null);
    const incoming = body?.answers;
    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json({ error: "Missing answers" }, { status: 400 });
    }

    const fields: Array<{
      id: string;
      type: string;
      label: string;
      required: boolean;
    }> = JSON.parse(submission.template.fields);

    const answers: AnswerOut[] = [];
    for (const f of fields) {
      const raw = (incoming as Record<string, unknown>)[f.id];
      const isEmpty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0);
      if (f.required && isEmpty) {
        return NextResponse.json(
          { error: `Required: ${f.label || f.id}` },
          { status: 400 }
        );
      }
      answers.push({
        fieldId: f.id,
        type: f.type,
        label: f.label,
        value: isEmpty ? null : raw,
      });
    }

    const checkIn = submission.reservation.checkIn.toISOString().slice(0, 10);
    const checkOut = submission.reservation.checkOut.toISOString().slice(0, 10);
    const validation = validatePrecheckinPayload(
      { ...(body?.precheckin ?? {}), customAnswers: answers },
      {
        checkIn,
        checkOut,
        maxTravelers: submission.reservation.bookedGuestCount ?? undefined,
      },
    );
    if (!validation.ok || !validation.payload) {
      return NextResponse.json({ error: "Traveler data is incomplete", fields: validation.errors }, { status: 400 });
    }
    const securePayload = encryptGuestData({
      ...validation.payload,
      travelers: validation.payload.travelers.map((traveler) => ({
        ...traveler,
        // Do not trust the browser's clientId as the durable identity used by
        // eVisitor receipts and duplicate-send protection.
        guestId: randomUUID(),
      })),
    });

    // Claim the one-shot submission atomically. Two browser tabs (or a
    // retried request racing the first one) may both have read the active
    // state above; only one is allowed to persist identity data. A plain
    // update would let the later request silently replace the first payload.
    const claimed = await prisma.guestFormSubmission.updateMany({
      where: {
        id: submission.id,
        submittedAt: null,
        status: { in: ["PENDING", "NOT_INVITED", "INVITED", "IN_PROGRESS"] },
        revokedAt: null,
      },
      data: {
        // New structured submissions are encrypted as one canonical payload.
        // `answers` remains only for reading legacy rows created before this
        // hardening change.
        answers: "[]",
        securePayload,
        status: "GUEST_COMPLETE",
        submittedAt: new Date(),
        lastChangedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (claimed.count !== 1) {
      return NextResponse.json(
        { error: "This form has already been submitted." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, status: "GUEST_COMPLETE" });
  } catch (err) {
    console.error("Guest submit failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
