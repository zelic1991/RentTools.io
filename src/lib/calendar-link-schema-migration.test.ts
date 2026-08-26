import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import { alignCalendarLinkBufferDefaults } from "./calendar-link-schema-migration";

const tempDirs: string[] = [];

function runCanonicalSchemaPush(dbPath: string): string {
  const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsxCli, "prisma/push-schema.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}`, TURSO_DATABASE_URL: "" },
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(`Schema push failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function createClient() {
  const dir = mkdtempSync(path.join(tmpdir(), "renttools-calendar-default-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "test.db");
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
  const prisma = new PrismaClient({ adapter });
  return { prisma, dbPath };
}

async function createFixture(
  prisma: PrismaClient,
  defaultBefore: number,
  defaultAfter: number,
  extraTableConstraint = "",
) {
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Property" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`INSERT INTO "Property" ("id", "name") VALUES (1, 'Synthetic')`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "CalendarLink" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "propertyId" INTEGER NOT NULL,
      "platform" TEXT NOT NULL,
      "icalExportUrl" TEXT NOT NULL,
      "bufferBefore" INTEGER NOT NULL DEFAULT ${defaultBefore},
      "bufferAfter" INTEGER NOT NULL DEFAULT ${defaultAfter},
      "lastFetchedAt" DATETIME,
      "lastError" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "failureCount" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "CalendarLink_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE${extraTableConstraint}
    )
  `);
}

async function defaults(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string; dflt_value: string }>>(
    `PRAGMA table_info("CalendarLink")`,
  );
  return Object.fromEntries(
    rows
      .filter((row) => row.name === "bufferBefore" || row.name === "bufferAfter")
      .map((row) => [row.name, String(row.dflt_value)]),
  );
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    } catch (error) {
      // libSQL can retain the disposable file handle until the Vitest worker
      // exits on Windows. The fixture contains synthetic data only.
      if (!(process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EBUSY")) {
        throw error;
      }
    }
  }
});

describe("alignCalendarLinkBufferDefaults", () => {
  it("migrates legacy 1/1 defaults while preserving existing 0/0 row values", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 1);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CalendarLink"
          ("propertyId", "platform", "icalExportUrl", "bufferBefore", "bufferAfter")
        VALUES (1, 'airbnb', 'https://example.invalid/a.ics', 0, 0)
      `);

      const result = await alignCalendarLinkBufferDefaults(prisma);
      expect(result).toMatchObject({ status: "migrated", rowCount: 1 });
      expect(await defaults(prisma)).toEqual({ bufferBefore: "0", bufferAfter: "0" });
      expect(
        await prisma.$queryRawUnsafe(`SELECT bufferBefore, bufferAfter FROM "CalendarLink"`),
      ).toEqual([{ bufferBefore: 0, bufferAfter: 0 }]);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("preserves deliberate buffers and every CalendarLink field", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 1);
      await prisma.$executeRawUnsafe(`CREATE INDEX "CalendarLink_platform_idx" ON "CalendarLink"("platform")`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "CalendarLinkAudit" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "linkId" INTEGER NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "CalendarLink_insert_audit"
        AFTER INSERT ON "CalendarLink"
        BEGIN
          INSERT INTO "CalendarLinkAudit" ("linkId") VALUES (NEW."id");
        END
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CalendarLink"
          ("id", "propertyId", "platform", "icalExportUrl", "bufferBefore", "bufferAfter",
           "lastFetchedAt", "lastError", "createdAt", "failureCount")
        VALUES
          (4, 1, 'booking', 'https://example.invalid/b.ics', 2, 1,
           '2027-01-02T03:04:05Z', 'synthetic-error', '2027-01-01T00:00:00Z', 7),
          (9, 1, 'direct', 'https://example.invalid/d.ics', 3, 0,
           NULL, NULL, '2027-02-01T00:00:00Z', 0)
      `);
      const before = await prisma.$queryRawUnsafe(`SELECT * FROM "CalendarLink" ORDER BY id`);

      const result = await alignCalendarLinkBufferDefaults(prisma);
      const after = await prisma.$queryRawUnsafe(`SELECT * FROM "CalendarLink" ORDER BY id`);

      expect(result).toMatchObject({
        status: "migrated",
        rowCount: 2,
        preservedIndexes: 1,
        preservedTriggers: 1,
      });
      expect(after).toEqual(before);
      expect(await defaults(prisma)).toEqual({ bufferBefore: "0", bufferAfter: "0" });

      await prisma.$executeRawUnsafe(`
        INSERT INTO "CalendarLink" ("propertyId", "platform", "icalExportUrl")
        VALUES (1, 'vrbo', 'https://example.invalid/v.ics')
      `);
      const inserted = await prisma.$queryRawUnsafe<
        Array<{ id: number; bufferBefore: number; bufferAfter: number }>
      >(`SELECT id, bufferBefore, bufferAfter FROM "CalendarLink" WHERE platform = 'vrbo'`);
      expect(inserted).toEqual([{ id: 10, bufferBefore: 0, bufferAfter: 0 }]);
      expect(
        await prisma.$queryRawUnsafe(`SELECT linkId FROM "CalendarLinkAudit" ORDER BY id`),
      ).toEqual([{ linkId: 4 }, { linkId: 9 }, { linkId: 10 }]);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("is a no-op when defaults are already canonical", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 0, 0);
      const result = await alignCalendarLinkBufferDefaults(prisma);
      expect(result).toEqual({
        status: "noop",
        rowCount: 0,
        preservedIndexes: 0,
        preservedTriggers: 0,
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("makes the second execution a no-op with no row changes", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 1);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CalendarLink"
          ("propertyId", "platform", "icalExportUrl", "bufferBefore", "bufferAfter")
        VALUES (1, 'airbnb', 'https://example.invalid/a.ics', 3, 3)
      `);
      expect((await alignCalendarLinkBufferDefaults(prisma)).status).toBe("migrated");
      const before = await prisma.$queryRawUnsafe(`SELECT * FROM "CalendarLink"`);
      expect((await alignCalendarLinkBufferDefaults(prisma)).status).toBe("noop");
      expect(await prisma.$queryRawUnsafe(`SELECT * FROM "CalendarLink"`)).toEqual(before);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("fails closed for an unexpected partial-default schema", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 0);
      await expect(alignCalendarLinkBufferDefaults(prisma)).rejects.toThrow(
        "Unexpected CalendarLink buffer defaults: 1/0",
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it("fails closed when another table references CalendarLink", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 1);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "CalendarLinkConsumer" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "linkId" INTEGER NOT NULL REFERENCES CalendarLink(id)
        )
      `);
      await expect(alignCalendarLinkBufferDefaults(prisma)).rejects.toThrow(
        "CalendarLink has referencing tables; refusing unsafe rebuild",
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it("fails closed for a differently-cased foreign-key reference without deleting child rows", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 1);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CalendarLink"
          ("id", "propertyId", "platform", "icalExportUrl")
        VALUES (41, 1, 'airbnb', 'https://example.invalid/case-fk.ics')
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "CalendarLinkCaseConsumer" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "linkId" INTEGER NOT NULL REFERENCES "calendarlink"("id") ON DELETE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CalendarLinkCaseConsumer" ("linkId") VALUES (41)`,
      );

      await expect(alignCalendarLinkBufferDefaults(prisma)).rejects.toThrow(
        "CalendarLink has referencing tables; refusing unsafe rebuild",
      );

      expect(await defaults(prisma)).toEqual({ bufferBefore: "1", bufferAfter: "1" });
      expect(
        await prisma.$queryRawUnsafe(`SELECT "linkId" FROM "CalendarLinkCaseConsumer"`),
      ).toEqual([{ linkId: 41 }]);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("preserves a trigger declared against a differently-cased CalendarLink name", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 1);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "CalendarLinkCaseAudit" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "linkId" INTEGER NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "CalendarLink_case_insert_audit"
        AFTER INSERT ON "calendarlink"
        BEGIN
          INSERT INTO "CalendarLinkCaseAudit" ("linkId") VALUES (NEW."id");
        END
      `);

      const result = await alignCalendarLinkBufferDefaults(prisma);
      expect(result).toMatchObject({ status: "migrated", preservedTriggers: 1 });

      await prisma.$executeRawUnsafe(`
        INSERT INTO "CalendarLink" ("propertyId", "platform", "icalExportUrl")
        VALUES (1, 'booking', 'https://example.invalid/case-trigger.ics')
      `);
      expect(
        await prisma.$queryRawUnsafe(`SELECT "linkId" FROM "CalendarLinkCaseAudit"`),
      ).toEqual([{ linkId: 1 }]);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("fails closed without dropping a generated column hidden from table_info", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(prisma, 1, 1);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CalendarLink"
         ADD COLUMN "generatedPlatform" TEXT
         GENERATED ALWAYS AS ("platform" || '-generated') VIRTUAL`,
      );
      const before = await prisma.$queryRawUnsafe(`PRAGMA table_xinfo("CalendarLink")`);

      await expect(alignCalendarLinkBufferDefaults(prisma)).rejects.toThrow(
        "Unexpected CalendarLink column shape; refusing unsafe rebuild",
      );

      expect(await prisma.$queryRawUnsafe(`PRAGMA table_xinfo("CalendarLink")`)).toEqual(before);
      expect(before).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "generatedPlatform" })]),
      );
      expect(await defaults(prisma)).toEqual({ bufferBefore: "1", bufferAfter: "1" });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("fails closed without removing an unknown CHECK constraint", async () => {
    const { prisma } = createClient();
    try {
      await createFixture(
        prisma,
        1,
        1,
        `, CONSTRAINT "CalendarLink_nonnegative_buffers"
           CHECK ("bufferBefore" >= 0 AND "bufferAfter" >= 0)`,
      );
      const before = await prisma.$queryRawUnsafe<Array<{ sql: string }>>(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'CalendarLink'`,
      );

      await expect(alignCalendarLinkBufferDefaults(prisma)).rejects.toThrow(
        "Unexpected CalendarLink table definition; refusing unsafe rebuild",
      );

      const after = await prisma.$queryRawUnsafe<Array<{ sql: string }>>(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'CalendarLink'`,
      );
      expect(after).toEqual(before);
      expect(after[0].sql).toContain("CalendarLink_nonnegative_buffers");
      expect(await defaults(prisma)).toEqual({ bufferBefore: "1", bufferAfter: "1" });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("is wired into the canonical push-schema path and remains idempotent", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "renttools-calendar-default-wiring-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "wired.db");

    expect(runCanonicalSchemaPush(dbPath)).toContain("CalendarLink buffer defaults noop");

    const prisma = new PrismaClient({
      adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
    });
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "User" ("id", "username", "password", "role")
         VALUES (501, 'synthetic-schema-owner', 'not-a-real-password', 'user')`,
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Property" ("id", "userId", "name")
         VALUES (501, 501, 'Synthetic Schema Property')`,
      );
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "CalendarLink_legacy_fixture" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "propertyId" INTEGER NOT NULL,
          "platform" TEXT NOT NULL,
          "icalExportUrl" TEXT NOT NULL,
          "bufferBefore" INTEGER NOT NULL DEFAULT 1,
          "bufferAfter" INTEGER NOT NULL DEFAULT 1,
          "lastFetchedAt" DATETIME,
          "lastError" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "failureCount" INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT "CalendarLink_propertyId_fkey"
            FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CalendarLink_legacy_fixture"
          ("id", "propertyId", "platform", "icalExportUrl", "bufferBefore", "bufferAfter")
         VALUES (501, 501, 'airbnb', 'https://example.invalid/wired.ics', 2, 1)`,
      );
      await prisma.$executeRawUnsafe(`DROP TABLE "CalendarLink"`);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CalendarLink_legacy_fixture" RENAME TO "CalendarLink"`,
      );
    } finally {
      await prisma.$disconnect();
    }

    const first = runCanonicalSchemaPush(dbPath);
    const second = runCanonicalSchemaPush(dbPath);
    expect(first).toContain("CalendarLink buffer defaults migrated");
    expect(second).toContain("CalendarLink buffer defaults noop");

    const verify = new PrismaClient({
      adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
    });
    try {
      expect(await defaults(verify)).toEqual({ bufferBefore: "0", bufferAfter: "0" });
      expect(
        await verify.$queryRawUnsafe(
          `SELECT id, propertyId, bufferBefore, bufferAfter FROM "CalendarLink"`,
        ),
      ).toEqual([{ id: 501, propertyId: 501, bufferBefore: 2, bufferAfter: 1 }]);
    } finally {
      await verify.$disconnect();
    }
  }, 150_000);
});
