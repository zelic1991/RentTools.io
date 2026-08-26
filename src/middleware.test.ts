import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ log: vi.fn() }));
vi.mock("@/lib/request-path", () => ({
  redactSensitiveRequestPath: (path: string) => path,
}));

let middleware: typeof import("./middleware").middleware;

const TEST_JWT_SECRET = "middleware-test-secret";
const secret = new TextEncoder().encode(TEST_JWT_SECRET);

async function sessionToken(impersonated = true): Promise<string> {
  const claims = impersonated
    ? {
        userId: 41,
        username: "customer",
        role: "user",
        impersonatorId: 7,
        impersonatorUsername: "support-admin",
      }
    : { userId: 41, username: "customer", role: "user" };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secret);
}

async function request(path: string, method: string, impersonated = true) {
  const token = await sessionToken(impersonated);
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { cookie: `rent-tool-session=${token}` },
  });
}

beforeAll(async () => {
  // The middleware captures JWT_SECRET at module evaluation time. Pin the
  // matching test secret before importing it so CI-provided environment
  // values cannot make otherwise valid test sessions look unauthenticated.
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.resetModules();
  ({ middleware } = await import("./middleware"));
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("impersonation server boundary", () => {
  it.each([
    ["PATCH", "/api/properties/17"],
    ["POST", "/api/auth/change-password"],
    ["PUT", "/api/calendar/schedule"],
    ["POST", "/api/calendar/cron"],
    ["GET", "/api/calendar/cron?secret=cron-secret"],
    ["HEAD", "/api/calendar/cron?secret=cron-secret"],
    ["GET", "/api/auth/export-data"],
    ["HEAD", "/api/auth/export-data"],
    ["POST", "/de/onboard"],
  ])("rejects %s %s while impersonating", async (method, path) => {
    const response = await middleware(await request(path, method));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Impersonation sessions are read-only",
    });
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it.each([
    ["/api/admin/exit-impersonation"],
    ["/api/auth/logout"],
  ])("allows POST %s so the operator can leave impersonation", async (path) => {
    const response = await middleware(await request(path, "POST"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps safe reads available while impersonating", async () => {
    const response = await middleware(await request("/api/properties/17", "GET"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the cron denial scoped to the exact state-changing GET route", async () => {
    const response = await middleware(
      await request("/api/calendar/cron-url", "GET"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("preserves ordinary secret-authenticated cron requests", async () => {
    const response = await middleware(
      await request("/api/calendar/cron?secret=cron-secret", "GET", false),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not block ordinary authenticated mutations", async () => {
    const response = await middleware(
      await request("/api/properties/17", "PATCH", false),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not broaden the exit exception to other methods", async () => {
    const response = await middleware(
      await request("/api/admin/exit-impersonation", "DELETE"),
    );

    expect(response.status).toBe(403);
  });
});
