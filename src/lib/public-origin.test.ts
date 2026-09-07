import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configuredPublicOrigin, getPublicOrigin } from "./public-origin";

const env = { PUBLIC_APP_URL: process.env.PUBLIC_APP_URL, NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL };
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe("getPublicOrigin", () => {
  beforeEach(() => { delete process.env.PUBLIC_APP_URL; delete process.env.NEXT_PUBLIC_APP_URL; });
  afterEach(() => {
    if (env.PUBLIC_APP_URL === undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL = env.PUBLIC_APP_URL;
    if (env.NEXT_PUBLIC_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = env.NEXT_PUBLIC_APP_URL;
  });

  it("prefers the configured canonical origin over every header", () => {
    process.env.PUBLIC_APP_URL = "https://app.example.com/";
    expect(getPublicOrigin(req("https://localhost:3000/x", { "x-forwarded-host": "proxy.example" }))).toBe("https://app.example.com");
  });

  it("ignores a configured value that is not an absolute http(s) URL", () => {
    process.env.PUBLIC_APP_URL = "app.example.com";
    expect(configuredPublicOrigin()).toBeNull();
    process.env.PUBLIC_APP_URL = "ftp://app.example.com";
    expect(configuredPublicOrigin()).toBeNull();
  });

  it("honours X-Forwarded-Host and -Proto", () => {
    expect(getPublicOrigin(req("http://localhost:3000/x", { "x-forwarded-proto": "https", "x-forwarded-host": "app.example.com" }))).toBe("https://app.example.com");
  });

  it("falls back to the browser's Origin before a proxy-rewritten Host", () => {
    // What the family instance's nginx hands Next: Host is the upstream hop.
    expect(getPublicOrigin(req("https://localhost:3000/api/x", { host: "localhost:3000", origin: "https://app.example.com" }))).toBe("https://app.example.com");
  });

  it("uses the request URL when nothing better is known", () => {
    expect(getPublicOrigin(req("http://localhost:3000/x"))).toBe("http://localhost:3000");
  });
});
