import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSetting: vi.fn(),
  getGeminiModel: vi.fn(),
  canManageProperty: vi.fn(),
  reservationFindUnique: vi.fn(),
  extractionLogCount: vi.fn(),
  extractionLogCreate: vi.fn(),
  guestFindFirst: vi.fn(),
  guestUpdate: vi.fn(),
  guestCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/site-settings", () => ({ getSetting: mocks.getSetting }));
vi.mock("@/lib/gemini", () => ({
  getGeminiModel: mocks.getGeminiModel,
  PASSPORT_PROMPT: "prompt",
}));
vi.mock("@/lib/ownership", () => ({
  canManageProperty: mocks.canManageProperty,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: { findUnique: mocks.reservationFindUnique },
    extractionLog: {
      count: mocks.extractionLogCount,
      create: mocks.extractionLogCreate,
    },
    guest: {
      findFirst: mocks.guestFindFirst,
      update: mocks.guestUpdate,
      create: mocks.guestCreate,
    },
  },
}));

import { POST } from "./route";

function requestFor(reservationId: string) {
  const body = new FormData();
  body.append("reservationId", reservationId);
  body.append("files", new File(["passport"], "passport.jpg", { type: "image/jpeg" }));
  return new NextRequest("http://localhost/api/extract", { method: "POST", body });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_LEGACY_PASSPORT_OCR_ENABLED", "true");
  mocks.getSession.mockResolvedValue({ userId: 5, role: "user" });
  mocks.getSetting.mockResolvedValue("0");
  mocks.reservationFindUnique.mockResolvedValue({ propertyId: 12 });
  mocks.canManageProperty.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/extract — reservation ownership", () => {
  it("rejects a cross-owner reservation before Gemini or guest writes", async () => {
    mocks.canManageProperty.mockResolvedValue(false);

    const response = await POST(requestFor("77"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(mocks.reservationFindUnique).toHaveBeenCalledWith({
      where: { id: 77 },
      select: { propertyId: true },
    });
    expect(mocks.canManageProperty).toHaveBeenCalledWith(12, 5, "user");
    expect(mocks.getGeminiModel).not.toHaveBeenCalled();
    expect(mocks.guestCreate).not.toHaveBeenCalled();
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });
});
