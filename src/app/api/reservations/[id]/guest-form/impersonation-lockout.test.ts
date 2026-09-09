import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The guest-facing privacy notice promises, in ten languages, that
 * RentTools support cannot read identity data even while temporarily
 * signed in as the host. That is a security claim printed on a form
 * people fill in under legal obligation, so it needs a test against the
 * real handlers rather than a sentence that merely exists.
 *
 * Exactly two route modules can decrypt a guest identity payload:
 * .../guest-form/handoff and .../guest-form/share. Every exported
 * handler in them must refuse an impersonated session before it reads
 * anything — before the ownership check, before the database, and
 * certainly before decryptGuestData.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  decryptGuestData: vi.fn(),
  reservationFindUnique: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  templateFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  validatedHandoff: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({ canManageProperty: mocks.canManageProperty }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: { findUnique: mocks.reservationFindUnique },
    guestFormSubmission: {
      findFirst: mocks.submissionFindFirst,
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
    },
    guestFormTemplate: { findFirst: mocks.templateFindFirst },
    auditLog: { create: mocks.auditCreate },
  },
}));
vi.mock("@/lib/precheckin-crypto", () => ({
  decryptGuestData: mocks.decryptGuestData,
  encryptGuestData: vi.fn(() => "encrypted"),
  guestDataEncryptionReady: vi.fn(() => true),
  hashShareToken: vi.fn(() => "hash"),
  maskDocumentNumber: vi.fn(() => "****"),
}));
vi.mock("@/lib/precheckin-handoff", () => ({
  validatedPrecheckinHandoffPayload: mocks.validatedHandoff,
}));

import { GET as handoffGet } from "./handoff/route";
import { GET as shareGet, POST as sharePost, PATCH as sharePatch } from "./share/route";

const params = Promise.resolve({ id: "7" });
const req = (method: string) =>
  new NextRequest("https://app.example/api/reservations/7/guest-form/share", {
    method,
    ...(method === "GET" ? {} : { body: JSON.stringify({ action: "MARK_SUBMITTED" }) }),
  });

const HANDLERS: [string, (r: NextRequest) => Promise<Response>][] = [
  ["handoff GET", (r) => handoffGet(r, { params })],
  ["share GET", (r) => shareGet(r, { params })],
  ["share POST", (r) => sharePost(r, { params })],
  ["share PATCH", (r) => sharePatch(r, { params })],
];

describe("support impersonation cannot reach the identity payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A support session: signed in as the host (userId 1), but carrying
    // the admin's id in impersonatorId. Everything else is permissive on
    // purpose — ownership passes, the reservation exists, a submission
    // with a payload is there. Only the impersonation marker should stop it.
    mocks.getSession.mockResolvedValue({
      userId: 1,
      username: "host",
      role: "user",
      impersonatorId: 99,
    });
    mocks.canManageProperty.mockResolvedValue(true);
    mocks.reservationFindUnique.mockResolvedValue({
      id: 7,
      propertyId: 10,
      checkIn: new Date("2027-05-16T00:00:00.000Z"),
      checkOut: new Date("2027-05-20T00:00:00.000Z"),
      bookedGuestCount: 1,
    });
    mocks.submissionFindFirst.mockResolvedValue({
      id: 3,
      reservationId: 7,
      securePayload: "cipher",
      submittedAt: new Date(),
    });
    mocks.decryptGuestData.mockReturnValue({ travelers: [{ documentNumber: "SECRET" }] });
  });

  it.each(HANDLERS)("%s refuses the impersonated session", async (_name, call) => {
    const res = await call(req(_name.endsWith("GET") ? "GET" : _name.endsWith("POST") ? "POST" : "PATCH"));
    expect(res.status).toBe(404);
  });

  it.each(HANDLERS)("%s never decrypts anything", async (_name, call) => {
    await call(req(_name.endsWith("GET") ? "GET" : _name.endsWith("POST") ? "POST" : "PATCH"));
    expect(mocks.decryptGuestData).not.toHaveBeenCalled();
    expect(mocks.validatedHandoff).not.toHaveBeenCalled();
  });

  it.each(HANDLERS)("%s stops before it even reads the submission", async (_name, call) => {
    await call(req(_name.endsWith("GET") ? "GET" : _name.endsWith("POST") ? "POST" : "PATCH"));
    expect(mocks.submissionFindFirst).not.toHaveBeenCalled();
    expect(mocks.canManageProperty).not.toHaveBeenCalled();
  });

  it("the same handlers do proceed for a genuine host session", async () => {
    // Proves the lockout above is the impersonation marker doing the
    // work, not a mock that refuses everything.
    mocks.getSession.mockResolvedValue({ userId: 1, username: "host", role: "user" });
    const res = await shareGet(req("GET"), { params });
    expect(res.status).not.toBe(404);
    expect(mocks.canManageProperty).toHaveBeenCalled();
  });
});
