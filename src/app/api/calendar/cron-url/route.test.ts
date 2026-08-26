import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/calendar/cron-url — secret disclosure", () => {
  it("rejects a non-superadmin before reading deployment headers", async () => {
    mocks.requireSuperadmin.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.headers).not.toHaveBeenCalled();
  });
});
