import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  resolve(process.cwd(), "deploy/systemd/rent-tool.service"),
  "utf8",
);

describe("rent-tool systemd service", () => {
  it("binds Next.js to loopback so nginx remains the only public entry point", () => {
    expect(service).toContain(
      "ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1",
    );
    expect(service).not.toMatch(/--hostname\s+(?:0\.0\.0\.0|::)(?:\s|$)/);
  });
});
