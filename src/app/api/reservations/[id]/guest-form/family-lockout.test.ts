import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Family access exists so relatives can see the stay and add a booking.
 * The pre-arrival form is a different thing: it mints a link that
 * collects passport numbers, and it decides how many travellers that link
 * is good for.
 *
 * The phone hides those buttons from a family account. That is a
 * courtesy. This test is the boundary: the handlers themselves must ask
 * for administration rights, so a family session is refused even when it
 * calls the endpoint directly — which is exactly how the gap was found.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  canAdministerProperty: vi.fn(),
  reservationFindUnique: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  templateFindFirst: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
  canAdministerProperty: mocks.canAdministerProperty,
}));
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
  decryptGuestData: vi.fn(),
  encryptGuestData: vi.fn(() => "encrypted"),
  guestDataEncryptionReady: vi.fn(() => true),
  hashShareToken: vi.fn(() => "hash"),
  maskDocumentNumber: vi.fn(() => "****"),
}));
vi.mock("@/lib/precheckin-handoff", () => ({
  validatedPrecheckinHandoffPayload: vi.fn(),
}));

import { GET as handoffGet } from "./handoff/route";
import { GET as shareGet, POST as sharePost } from "./share/route";

const params = Promise.resolve({ id: "7" });
const request = (method: string) =>
  new NextRequest("https://app.zelicfamilyvir.com/api/reservations/7/guest-form/share", {
    method,
  });

describe("family access cannot reach the pre-arrival form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId: 3, role: "user" });
    mocks.reservationFindUnique.mockResolvedValue({
      id: 7,
      propertyId: 1,
      checkOut: new Date("2026-09-20T00:00:00.000Z"),
      bookedGuestCount: 4,
    });
    // A family account: manageable in the old, wide sense — the very
    // check these routes used to make — but not an administrator.
    mocks.canManageProperty.mockResolvedValue(true);
    mocks.canAdministerProperty.mockResolvedValue(false);
  });

  it("refuses to read an existing invitation", async () => {
    const response = await shareGet(request("GET"), { params });
    expect(response.status).toBe(404);
    expect(mocks.submissionFindFirst).not.toHaveBeenCalled();
  });

  it("refuses to mint a link", async () => {
    const response = await sharePost(request("POST"), { params });
    expect(response.status).toBe(404);
    expect(mocks.submissionCreate).not.toHaveBeenCalled();
    expect(mocks.templateFindFirst).not.toHaveBeenCalled();
  });

  it("refuses the manual eVisitor handoff", async () => {
    const response = await handoffGet(request("GET"), { params });
    expect(response.status).toBe(404);
  });

  it("still lets a manager through, so the boundary is the level and not the endpoint", async () => {
    mocks.canAdministerProperty.mockResolvedValue(true);
    mocks.submissionFindFirst.mockResolvedValue(null);
    const response = await shareGet(request("GET"), { params });
    expect(response.status).toBe(200);
    expect(mocks.submissionFindFirst).toHaveBeenCalled();
  });
});
