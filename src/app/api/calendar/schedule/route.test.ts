import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireSuperadmin: vi.fn(),
  appSettingsFindMany: vi.fn(),
  appSettingsUpsert: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
  requireSuperadmin: mocks.requireSuperadmin,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    appSettings: {
      findMany: mocks.appSettingsFindMany,
      upsert: mocks.appSettingsUpsert,
    },
  },
}));

import { PUT } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.appSettingsUpsert.mockResolvedValue({});
});

describe("PUT /api/calendar/schedule — platform control", () => {
  it("rejects a normal authenticated user before changing global settings", async () => {
    mocks.requireSuperadmin.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const request = new NextRequest("http://localhost/api/calendar/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoEnabled: false }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(403);
    expect(mocks.appSettingsUpsert).not.toHaveBeenCalled();
  });
});
