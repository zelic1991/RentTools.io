import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  appSettingsFindMany: vi.fn(),
  appSettingsUpsert: vi.fn(),
  requireSuperadmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
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

import { GET, PUT } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireSuperadmin.mockResolvedValue({
    session: { userId: 99, username: "admin", role: "superadmin" },
    response: null,
  });
  mocks.appSettingsFindMany.mockResolvedValue([]);
  mocks.appSettingsUpsert.mockResolvedValue({});
});

describe("GET /api/settings role boundary", () => {
  it.each(["owner", "manager", "cleaner"])(
    "returns 403 for %s without reading global settings",
    async () => {
      mocks.requireSuperadmin.mockResolvedValue({
        session: null,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      });

      const response = await GET();

      expect(response.status).toBe(403);
      expect(mocks.appSettingsFindMany).not.toHaveBeenCalled();
    },
  );

  it("returns the complete settings map only to superadmin", async () => {
    mocks.appSettingsFindMany.mockResolvedValue([
      { key: "gemini_api_key", value: "gemini-secret" },
      { key: "future_internal_secret", value: "future-secret" },
      { key: "sync_auto_enabled", value: "true" },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      gemini_api_key: "gemini-secret",
      future_internal_secret: "future-secret",
      sync_auto_enabled: "true",
    });
  });
});

describe("PUT /api/settings mutation boundary", () => {
  it("rejects a non-superadmin before mutation", async () => {
    mocks.requireSuperadmin.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const request = new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "gemini_api_key", value: "new-secret" }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(403);
    expect(mocks.appSettingsUpsert).not.toHaveBeenCalled();
  });

  it("validates and writes a string setting for superadmin", async () => {
    const request = new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: " gemini_api_key ", value: "new-secret" }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(mocks.appSettingsUpsert).toHaveBeenCalledWith({
      where: { key: "gemini_api_key" },
      update: { value: "new-secret" },
      create: { key: "gemini_api_key", value: "new-secret" },
    });
  });
});
