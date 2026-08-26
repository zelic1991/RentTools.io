import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decryptGuestData: vi.fn(),
}));

vi.mock("@/lib/precheckin-crypto", () => ({
  decryptGuestData: mocks.decryptGuestData,
}));

import { validatedPrecheckinHandoffPayload } from "@/lib/precheckin-handoff";

const payload = {
  version: 1,
  expectedArrivalDate: "stale-client-value",
  expectedDepartureDate: "stale-client-value",
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
  }],
  customAnswers: [],
};

const reservation = {
  checkIn: new Date("2027-05-16T00:00:00.000Z"),
  checkOut: new Date("2027-05-20T00:00:00.000Z"),
  bookedGuestCount: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.decryptGuestData.mockReturnValue(payload);
});

describe("validated manual eVisitor handoff payload", () => {
  it("re-decrypts and binds dates and traveler limit to the reservation", () => {
    const result = validatedPrecheckinHandoffPayload(
      "encrypted-payload",
      reservation,
    );

    expect(mocks.decryptGuestData).toHaveBeenCalledWith("encrypted-payload");
    expect(result).toMatchObject({
      expectedArrivalDate: "2027-05-16",
      expectedDepartureDate: "2027-05-20",
      travelers: [{ documentNumber: "FULL-123456" }],
    });
  });

  it("fails closed for a missing guest count, too many travelers, or decrypt failure", () => {
    expect(validatedPrecheckinHandoffPayload("encrypted-payload", {
      ...reservation,
      bookedGuestCount: null,
    })).toBeNull();

    mocks.decryptGuestData.mockReturnValue({
      ...payload,
      travelers: [
        payload.travelers[0],
        {
          ...payload.travelers[0],
          clientId: "guest-2",
          isLead: false,
          firstName: "Ivan",
          documentNumber: "FULL-654321",
        },
      ],
    });
    expect(validatedPrecheckinHandoffPayload("encrypted-payload", reservation))
      .toBeNull();

    mocks.decryptGuestData.mockImplementation(() => {
      throw new Error("wrong key");
    });
    expect(validatedPrecheckinHandoffPayload("encrypted-payload", reservation))
      .toBeNull();
  });

  it("rejects a partial party even when the payload is otherwise valid", () => {
    expect(validatedPrecheckinHandoffPayload("encrypted-payload", {
      ...reservation,
      bookedGuestCount: 3,
    })).toBeNull();
  });

  it("blocks EVISITOR_READY when required non-EU border fields are incomplete", () => {
    mocks.decryptGuestData.mockReturnValue({
      ...payload,
      travelers: [{
        ...payload.travelers[0],
        citizenshipCountry: "US",
        residenceCountry: "US",
      }],
    });

    expect(validatedPrecheckinHandoffPayload("encrypted-payload", reservation))
      .toBeNull();
  });
});
