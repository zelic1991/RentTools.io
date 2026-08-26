import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  canManageProperty: vi.fn(),
  reservationFindUnique: vi.fn(),
  submissionFindFirst: vi.fn(),
  validatedHandoff: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: { findUnique: mocks.reservationFindUnique },
    guestFormSubmission: { findFirst: mocks.submissionFindFirst },
  },
}));
vi.mock("@/lib/precheckin-handoff", () => ({
  validatedPrecheckinHandoffPayload: mocks.validatedHandoff,
}));

import { GET } from "./route";

const reservation = {
  id: 7,
  propertyId: 10,
  checkIn: new Date("2027-05-16T00:00:00.000Z"),
  checkOut: new Date("2027-05-20T00:00:00.000Z"),
  bookedGuestCount: 1,
};

const payload = {
  version: 1,
  expectedArrivalDate: "2027-05-16",
  expectedDepartureDate: "2027-05-20",
  expectedArrivalTime: "16:30",
  arrivalOrganization: "INDIVIDUAL",
  serviceType: "ACCOMMODATION",
  travelers: [{
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
  }],
  customAnswers: [],
};

const request = new NextRequest(
  "http://localhost/api/reservations/7/guest-form/handoff",
);
const params = { params: Promise.resolve({ id: "7" }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 3, role: "user" });
  mocks.canManageProperty.mockResolvedValue(true);
  mocks.reservationFindUnique.mockResolvedValue(reservation);
  mocks.submissionFindFirst.mockResolvedValue({
    id: 40,
    status: "EVISITOR_READY",
    securePayload: "encrypted-payload",
  });
  mocks.validatedHandoff.mockReturnValue(payload);
});

describe("GET protected manual eVisitor handoff", () => {
  it("returns the full document only with no-store headers to an authorized operator", async () => {
    const response = await GET(request, params);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    const body = await response.json();
    expect(body.travelers[0]).toMatchObject({
      firstName: "Ana",
      documentNumber: "FULL-123456",
    });
    expect(body).not.toHaveProperty("customAnswers");
  });

  it.each([
    [{ userId: 3, role: "cleaner" }, "cleaner"],
    [{ userId: 99, role: "user" }, "other owner"],
  ])("denies %s access without decrypting", async (session) => {
    mocks.getSession.mockResolvedValue(session);
    mocks.canManageProperty.mockResolvedValue(false);

    const response = await GET(request, params);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.submissionFindFirst).not.toHaveBeenCalled();
    expect(mocks.validatedHandoff).not.toHaveBeenCalled();
  });

  it("denies impersonation before reservation access", async () => {
    mocks.getSession.mockResolvedValue({
      userId: 3,
      role: "user",
      impersonatorId: 900,
    });

    const response = await GET(request, params);

    expect(response.status).toBe(404);
    expect(mocks.reservationFindUnique).not.toHaveBeenCalled();
  });

  it("does not expose plaintext before EVISITOR_READY", async () => {
    mocks.submissionFindFirst.mockResolvedValue({
      id: 40,
      status: "OWNER_APPROVED",
      securePayload: "encrypted-payload",
    });

    const response = await GET(request, params);

    expect(response.status).toBe(409);
    expect(mocks.validatedHandoff).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("FULL-123456");
  });
});
