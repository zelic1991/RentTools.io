import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");

describe("dashboard Zelic brand scope", () => {
  it("brands both the dashboard shell and its loading fallback", () => {
    expect(source).toContain(
      'className="editorial zf-brand flex h-screen flex-col overflow-hidden bg-[var(--bg)]"',
    );
    expect(source).toContain(
      'className="editorial zf-brand flex h-screen items-center justify-center bg-[var(--bg)] text-[var(--ink-3)]"',
    );
  });
});
