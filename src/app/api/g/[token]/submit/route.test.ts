import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findSubmissionByPublicToken: vi.fn(),
  publicSubmissionState: vi.fn(),
  sameOriginRequest: vi.fn(),
  validatePrecheckinPayload: vi.fn(),
  encryptGuestData: vi.fn(),
  hashShareToken: vi.fn(),
  checkRateLimit: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/guest-form-security", () => ({
  findSubmissionByPublicToken: mocks.findSubmissionByPublicToken,
  publicSubmissionState: mocks.publicSubmissionState,
  sameOriginRequest: mocks.sameOriginRequest,
}));
vi.mock("@/lib/precheckin", () => ({
  validatePrecheckinPayload: mocks.validatePrecheckinPayload,
}));
vi.mock("@/lib/precheckin-crypto", () => ({
  encryptGuestData: mocks.encryptGuestData,
  hashShareToken: mocks.hashShareToken,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIp: () => "test-ip",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { guestFormSubmission: { updateMany: mocks.updateMany } },
}));

import { POST } from "./route";

const token = "a".repeat(48);

function request() {
  return new NextRequest(`https://example.test/api/g/${token}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ answers: {}, precheckin: {} }),
  });
}

function context() {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.sameOriginRequest.mockReturnValue(true);
  mocks.hashShareToken.mockReturnValue("token-hash");
  mocks.checkRateLimit.mockReturnValue({ ok: true, resetSeconds: 0 });
  mocks.publicSubmissionState.mockReturnValue("active");
  mocks.findSubmissionByPublicToken.mockResolvedValue({
    id: 41,
    status: "PENDING",
    template: { fields: "[]" },
    reservation: {
      checkIn: new Date("2027-05-16T00:00:00.000Z"),
      checkOut: new Date("2027-05-28T00:00:00.000Z"),
      bookedGuestCount: 1,
      property: { feedToken: "protected" },
    },
  });
  mocks.validatePrecheckinPayload.mockReturnValue({
    ok: true,
    errors: [],
    payload: { travelers: [{ firstName: "Synthetic" }], customAnswers: [] },
  });
  mocks.encryptGuestData.mockReturnValue("encrypted-payload");
});

describe("public guest submit one-shot claim", () => {
  it("fails closed before writing when the stored status is invalid", async () => {
    mocks.publicSubmissionState.mockReturnValue("invalid");

    const response = await POST(request(), context());

    expect(response.status).toBe(410);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("persists only through a conditional active-submission claim", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 41,
        submittedAt: null,
        status: { in: ["PENDING", "NOT_INVITED", "INVITED", "IN_PROGRESS"] },
        revokedAt: null,
      },
      data: expect.objectContaining({
        status: "GUEST_COMPLETE",
        securePayload: "encrypted-payload",
      }),
    }));
    await expect(response.json()).resolves.toEqual({
      success: true,
      status: "GUEST_COMPLETE",
    });
  });

  it("rejects the losing concurrent submit instead of replacing guest data", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(request(), context());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This form has already been submitted.",
    });
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });
});
