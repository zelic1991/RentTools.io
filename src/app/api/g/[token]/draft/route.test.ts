import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  checkRateLimit: vi.fn(),
  findSubmission: vi.fn(),
  publicState: vi.fn(),
  sameOrigin: vi.fn(),
  encryptGuestData: vi.fn(),
  sanitizeDraft: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { guestFormSubmission: { updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/guest-form-security", () => ({
  findSubmissionByPublicToken: mocks.findSubmission,
  publicSubmissionState: mocks.publicState,
  sameOriginRequest: mocks.sameOrigin,
}));
vi.mock("@/lib/precheckin-crypto", () => ({
  encryptGuestData: mocks.encryptGuestData,
  hashShareToken: vi.fn(() => "token-hash"),
}));
vi.mock("@/lib/precheckin", () => ({
  sanitizePrecheckinDraft: mocks.sanitizeDraft,
}));

import { PUT } from "./route";

const token = "t".repeat(32);
const params = { params: Promise.resolve({ token }) };

function request() {
  return new NextRequest(`http://localhost/api/g/${token}/draft`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ precheckin: { travelers: [] } }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkRateLimit.mockReturnValue({ ok: true });
  mocks.sameOrigin.mockReturnValue(true);
  mocks.publicState.mockReturnValue("active");
  mocks.findSubmission.mockResolvedValue({
    id: 40,
    submittedAt: null,
    status: "IN_PROGRESS",
    revokedAt: null,
    reservation: { property: { feedToken: "protected-feed" } },
  });
  mocks.sanitizeDraft.mockReturnValue({ travelers: [] });
  mocks.encryptGuestData.mockReturnValue("encrypted-draft");
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("PUT /api/g/:token/draft", () => {
  it("saves only while the row remains atomically editable", async () => {
    const response = await PUT(request(), params);

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 40,
        submittedAt: null,
        status: { in: ["PENDING", "NOT_INVITED", "INVITED", "IN_PROGRESS"] },
        revokedAt: null,
      },
      data: {
        securePayload: "encrypted-draft",
        status: "IN_PROGRESS",
        lastChangedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
  });

  it("does not overwrite a final submit that wins after the state read", async () => {
    // Simulates: publicSubmissionState observed active, then submit changed the
    // row before this delayed autosave reached the conditional update.
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await PUT(request(), params);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This form has already been submitted.",
    });
    expect(mocks.updateMany).toHaveBeenCalledOnce();
  });
});
