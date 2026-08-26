import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectSchemaInputPaths,
  fingerprintSchemaInputs,
} from "../../scripts/schema-input-fingerprint.mjs";

const tempDirs: string[] = [];

function write(root: string, path: string, content: string) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "renttools-schema-inputs-"));
  tempDirs.push(root);
  write(root, "prisma/schema.prisma", "model Synthetic { id Int @id }\n");
  write(
    root,
    "prisma/push-schema.ts",
    'import type { PrismaClient } from "../src/generated/prisma/client";\n' +
      'import { migrate } from "../src/lib/calendar-link-schema-migration";\n' +
      'declare const prisma: PrismaClient;\nmigrate(prisma);\n',
  );
  write(root, "src/lib/calendar-link-schema-migration.ts", "export const migrate = () => 1;\n");
  write(root, "src/app/page.tsx", "export default function Page() { return null; }\n");
  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("schema input fingerprint", () => {
  it("tracks schema.prisma, push-schema.ts, and recursively imported migration modules", () => {
    const root = fixture();
    expect(
      collectSchemaInputPaths(root).map((path) =>
        path.slice(root.length + 1).replaceAll("\\", "/"),
      ),
    ).toEqual([
      "prisma/push-schema.ts",
      "prisma/schema.prisma",
      "src/lib/calendar-link-schema-migration.ts",
    ]);

    for (const path of [
      "prisma/schema.prisma",
      "prisma/push-schema.ts",
      "src/lib/calendar-link-schema-migration.ts",
    ]) {
      const before = fingerprintSchemaInputs(root);
      writeFileSync(join(root, path), `${readFileSync(join(root, path), "utf8")}\n// changed`);
      expect(fingerprintSchemaInputs(root)).not.toBe(before);
    }
  });

  it("does not trigger for an unrelated UI file", () => {
    const root = fixture();
    const before = fingerprintSchemaInputs(root);
    write(root, "src/app/page.tsx", "export default function Page() { return <main />; }\n");
    expect(fingerprintSchemaInputs(root)).toBe(before);
  });

  it("keeps install-build wired to the fingerprint gate and canonical schema push", () => {
    const installBuild = readFileSync(resolve(process.cwd(), "scripts/install-build.sh"), "utf8");
    const deployWorkflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/deploy.yml"),
      "utf8",
    );
    expect(installBuild).toContain(
      'SCHEMA_INPUTS_BEFORE=$(node "$SCHEMA_FINGERPRINT_SCRIPT" "$REPO")',
    );
    expect(installBuild).toContain(
      'SCHEMA_INPUTS_AFTER=$(node "$SCHEMA_FINGERPRINT_SCRIPT" "$REPO")',
    );
    expect(installBuild).toContain(
      '[ "$SCHEMA_INPUTS_BEFORE" != "$SCHEMA_INPUTS_AFTER" ]',
    );
    expect(installBuild).toContain("npx tsx prisma/push-schema.ts");
    expect(deployWorkflow.match(/scripts\/schema-input-fingerprint\.mjs/g)).toHaveLength(2);
  });
});
