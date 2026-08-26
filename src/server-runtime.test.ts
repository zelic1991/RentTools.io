import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("production server loopback contract", () => {
  it("separates Next's normalized router hostname from the listen address", () => {
    expect(packageJson.scripts.start).toBe("node server.mjs");

    const source = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
    expect(source).toContain('const routerHostname = "localhost";');
    expect(source).toContain('const listenHost = "127.0.0.1";');
    expect(source).toContain("hostname: routerHostname");
    expect(source).toContain("server.listen(port, listenHost");
  });
});
