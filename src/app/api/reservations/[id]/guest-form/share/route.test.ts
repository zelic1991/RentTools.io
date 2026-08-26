import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  reservationFindUnique: vi.fn(),
  templateFindFirst: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  decryptGuestData: vi.fn(),
  encryptGuestData: vi.fn(),
  hashShareToken: vi.fn(),
  mintGuestFormToken: vi.fn(),
  guestFormExpiry: vi.fn(),
  validatedHandoff: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: { findUnique: mocks.reservationFindUnique },
    guestFormTemplate: { findFirst: mocks.templateFindFirst },
    guestFormSubmission: {
      findFirst: mocks.submissionFindFirst,
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/precheckin-crypto", () => ({
  decryptGuestData: mocks.decryptGuestData,
  encryptGuestData: mocks.encryptGuestData,
  guestDataEncryptionReady: vi.fn(() => true),
  hashShareToken: mocks.hashShareToken,
  maskDocumentNumber: vi.fn(() => "MASKED-56"),
}));
vi.mock("@/lib/guest-form-security", () => ({
  decryptOwnerShareToken: vi.fn(() => null),
  guestFormExpiry: mocks.guestFormExpiry,
  mintGuestFormToken: mocks.mintGuestFormToken,
}));
vi.mock("@/lib/precheckin-handoff", () => ({
  validatedPrecheckinHandoffPayload: mocks.validatedHandoff,
}));

import { GET, PATCH, POST } from "./route";

const reservation = {
  id: 7,
  propertyId: 10,
  checkIn: new Date("2027-05-16T00:00:00.000Z"),
  checkOut: new Date("2027-05-20T00:00:00.000Z"),
  bookedGuestCount: 1,
  property: { feedToken: "protected-feed" },
};

const traveler = {
  clientId: "lead-1",
  isLead: true,
  firstName: "Ana",
  lastName: "Horvat",
  dateOfBirth: "1990-05-20",
  gender: "F",
  citizenshipCountry: "HR",
  birthCountry: "HR",
  birthPlace: "Zagreb",
  residenceCountry: "HR",
  residencePlace: "Zagreb",
  residenceAddress: "Example 1",
  documentType: "IDENTITY_CARD",
  documentNumber: "FULL-123456",
  taxCategorySuggestion: "STANDARD_ADULT",
};

const payload = {
  version: 1,
  expectedArrivalDate: "2027-05-16",
  expectedDepartureDate: "2027-05-20",
  expectedArrivalTime: "16:30",
  arrivalOrganization: "INDIVIDUAL",
  serviceType: "ACCOMMODATION",
  travelers: [traveler],
  customAnswers: [],
};

function submission(status: string) {
  return {
    id: 40,
    reservationId: 7,
    templateId: 8,
    shareToken: "hashed:token",
    tokenHash: "hash",
    tokenCiphertext: null,
    status,
    expiresAt: new Date("2027-05-21T00:00:00.000Z"),
    revokedAt: null,
    securePayload: "encrypted-payload",
    ownerApprovedAt: null,
    lastChangedAt: new Date("2027-05-15T00:00:00.000Z"),
    answers: "[]",
    submittedAt: new Date("2027-05-15T00:00:00.000Z"),
    createdAt: new Date("2027-05-10T00:00:00.000Z"),
    updatedAt: null,
  };
}

function patchRequest(action: string) {
  return new NextRequest("http://localhost/api/reservations/7/guest-form/share", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

const params = { params: Promise.resolve({ id: "7" }) };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-05-15T12:00:00.000Z"));
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, role: "user" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.reservationFindUnique.mockResolvedValue(reservation);
  mocks.templateFindFirst.mockResolvedValue({ id: 8 });
  mocks.submissionFindFirst.mockResolvedValue(submission("OWNER_REVIEW"));
  mocks.submissionUpdate.mockResolvedValue({ id: 40 });
  mocks.auditCreate.mockResolvedValue({ id: 90 });
  mocks.transaction.mockImplementation(async (operations) => Promise.all(operations));
  mocks.validatedHandoff.mockReturnValue(payload);
  mocks.decryptGuestData.mockReturnValue(payload);
  mocks.encryptGuestData.mockReturnValue("encrypted-token");
  mocks.hashShareToken.mockReturnValue("token-hash");
  mocks.mintGuestFormToken.mockReturnValue("raw-share-token");
  mocks.guestFormExpiry.mockReturnValue(new Date("2027-05-21T23:59:59.999Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("manual eVisitor handoff transitions", () => {
  it("starts owner review from a guest-complete submission", async () => {
    mocks.submissionFindFirst.mockResolvedValue(submission("GUEST_COMPLETE"));

    const response = await PATCH(patchRequest("start-review"), params);

    expect(response.status).toBe(200);
    expect(mocks.submissionUpdate).toHaveBeenCalledWith({
      where: { id: 40, status: "GUEST_COMPLETE" },
      data: {
        status: "OWNER_REVIEW",
        lastChangedAt: new Date("2027-05-15T12:00:00.000Z"),
        updatedAt: new Date("2027-05-15T12:00:00.000Z"),
      },
    });
  });

  it("atomically audits the approving actor and transition time", async () => {
    const response = await PATCH(patchRequest("approve"), params);

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.submissionUpdate).toHaveBeenCalledWith({
      where: { id: 40, status: "OWNER_REVIEW" },
      data: {
        status: "OWNER_APPROVED",
        ownerApprovedAt: new Date("2027-05-15T12:00:00.000Z"),
        lastChangedAt: new Date("2027-05-15T12:00:00.000Z"),
        updatedAt: new Date("2027-05-15T12:00:00.000Z"),
      },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 3,
        action: "update",
        resourceType: "guest",
        resourceId: 40,
        createdAt: new Date("2027-05-15T12:00:00.000Z"),
      }),
    });
    const auditPayload = JSON.parse(mocks.auditCreate.mock.calls[0][0].data.payload);
    expect(auditPayload).toEqual({
      transition: "approve",
      fromStatus: "OWNER_REVIEW",
      toStatus: "OWNER_APPROVED",
      reservationId: 7,
    });
  });

  it("accepts a legacy owner-review row and writes the canonical approval", async () => {
    mocks.submissionFindFirst.mockResolvedValue(submission("OWNER_REVIEW_REQUIRED"));

    const response = await PATCH(patchRequest("approve"), params);

    expect(response.status).toBe(200);
    expect(mocks.submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 40, status: "OWNER_REVIEW_REQUIRED" },
        data: expect.objectContaining({ status: "OWNER_APPROVED" }),
      }),
    );
  });

  it("re-decrypts and validates before marking the handoff ready", async () => {
    mocks.submissionFindFirst.mockResolvedValue(submission("OWNER_APPROVED"));

    const response = await PATCH(patchRequest("mark-evisitor-ready"), params);

    expect(response.status).toBe(200);
    expect(mocks.validatedHandoff).toHaveBeenCalledWith(
      "encrypted-payload",
      reservation,
    );
    expect(mocks.submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 40, status: "OWNER_APPROVED" },
        data: expect.objectContaining({ status: "EVISITOR_READY" }),
      }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 3,
        createdAt: new Date("2027-05-15T12:00:00.000Z"),
        payload: expect.stringContaining('"toStatus":"EVISITOR_READY"'),
      }),
    });
  });

  it("fails closed when current reservation validation fails", async () => {
    mocks.submissionFindFirst.mockResolvedValue(submission("OWNER_APPROVED"));
    mocks.validatedHandoff.mockReturnValue(null);

    const response = await PATCH(patchRequest("mark-evisitor-ready"), params);

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("returns a conflict when a concurrent request already changed the source state", async () => {
    mocks.transaction.mockRejectedValue({ code: "P2025" });

    const response = await PATCH(patchRequest("approve"), params);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid status transition",
    });
  });

  it("audits manual confirmation without contacting eVisitor", async () => {
    mocks.submissionFindFirst.mockResolvedValue(submission("EVISITOR_READY"));

    const response = await PATCH(patchRequest("confirm-evisitor-manual"), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "EVISITOR_CONFIRMED_MANUAL",
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 3,
        createdAt: new Date("2027-05-15T12:00:00.000Z"),
        payload: expect.stringContaining(
          '"toStatus":"EVISITOR_CONFIRMED_MANUAL"',
        ),
      }),
    });
  });

  it.each([
    [{ userId: 3, role: "cleaner" }, "cleaner"],
    [{ userId: 99, role: "user" }, "other owner"],
  ])("denies a %s before loading the submission", async (session) => {
    mocks.getSession.mockResolvedValue(session);
    mocks.canManageProperty.mockResolvedValue(false);

    const response = await PATCH(patchRequest("approve"), params);

    expect(response.status).toBe(404);
    expect(mocks.submissionFindFirst).not.toHaveBeenCalled();
  });

  it("denies support impersonation before reservation access", async () => {
    mocks.getSession.mockResolvedValue({
      userId: 3,
      role: "user",
      impersonatorId: 999,
    });

    const response = await PATCH(patchRequest("approve"), params);

    expect(response.status).toBe(404);
    expect(mocks.reservationFindUnique).not.toHaveBeenCalled();
  });
});

describe("normal owner review response", () => {
  it("keeps the full document number out of the share endpoint", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/reservations/7/guest-form/share"),
      params,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.submission.travelers[0]).toMatchObject({
      documentNumberMasked: "MASKED-56",
    });
    expect(body.submission.travelers[0]).not.toHaveProperty("documentNumber");
  });
});

describe("guest-form sharing", () => {
  it("creates a new invitation at the canonical pending state", async () => {
    mocks.submissionFindFirst.mockResolvedValue(null);
    mocks.submissionCreate.mockResolvedValue({
      submittedAt: null,
      status: "PENDING",
      expiresAt: new Date("2027-05-21T23:59:59.999Z"),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/reservations/7/guest-form/share", {
        method: "POST",
      }),
      params,
    );

    expect(response.status).toBe(200);
    expect(mocks.submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reservationId: 7,
        templateId: 8,
        status: "PENDING",
      }),
    });
  });
});
