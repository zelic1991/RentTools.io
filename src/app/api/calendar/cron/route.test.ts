import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  syncAllCalendars: vi.fn(),
  syncLogCreate: vi.fn(),
  appSettingsFindUnique: vi.fn(),
  appSettingsUpsert: vi.fn(),
}));

vi.mock("@/lib/calendar-sync", () => ({ syncAllCalendars: mocks.syncAllCalendars }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncLog: { create: mocks.syncLogCreate },
    appSettings: {
      findUnique: mocks.appSettingsFindUnique,
      upsert: mocks.appSettingsUpsert,
    },
  },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.syncLogCreate.mockResolvedValue({});
  mocks.appSettingsFindUnique.mockResolvedValue(null);
  mocks.appSettingsUpsert.mockResolvedValue({});
  mocks.syncAllCalendars.mockResolvedValue({
    propertiesSynced: 0,
    newEvents: 0,
    removedEvents: 0,
    errors: 0,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/calendar/cron — secret boundary", () => {
  it("does not fall back to JWT_SECRET when CRON_SECRET is empty", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("JWT_SECRET", "jwt-secret");
    const request = new NextRequest("http://localhost/api/calendar/cron", {
      headers: { authorization: "Bearer jwt-secret" },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mocks.syncAllCalendars).not.toHaveBeenCalled();
    expect(mocks.syncLogCreate).not.toHaveBeenCalled();
  });

  it("does not accept the literal Bearer undefined when CRON_SECRET is absent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const request = new NextRequest("http://localhost/api/calendar/cron", {
      headers: { authorization: "Bearer undefined" },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mocks.syncAllCalendars).not.toHaveBeenCalled();
  });
});
