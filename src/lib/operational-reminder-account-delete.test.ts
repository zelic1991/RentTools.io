import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";

const tempDirs: string[] = [];

function createDatabase() {
  const dir = mkdtempSync(path.join(tmpdir(), "renttools-reminder-delete-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "test.db");
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
  return new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${dbPath}` }) });
}

async function seedReminder(prisma: PrismaClient, creatorId: number, suffix: string) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "OperationalReminder"
      ("propertyId", "dedupeKey", "type", "portal", "status", "startDate", "endDate",
       "dueAt", "note", "createdByUserId")
    VALUES
      (1, '1|PORTAL_FOLLOW_UP|booking|${suffix}', 'PORTAL_FOLLOW_UP', 'Booking', 'OPEN',
       '2027-07-18', '2027-08-06', '2026-09-05T12:00:00.000Z', 'Synthetic', ${creatorId})
  `);
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    } catch (error) {
      if (!(process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EBUSY")) {
        throw error;
      }
    }
  }
});

describe("OperationalReminder account deletion lifecycle", () => {
  it("anonymises a deleted manager creator without losing the owner's reminder", async () => {
    const prisma = createDatabase();
    try {
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "User" ("id", "username", "password", "role") VALUES
          (1, 'synthetic-owner', 'unused', 'user'),
          (2, 'synthetic-manager', 'unused', 'manager')
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Property" ("id", "userId", "name") VALUES (1, 1, 'Synthetic')
      `);
      await seedReminder(prisma, 2, "manager");

      await expect(prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = 2`)).resolves.toBe(1);
      await expect(
        prisma.$queryRawUnsafe(`SELECT "createdByUserId" FROM "OperationalReminder"`),
      ).resolves.toEqual([{ createdByUserId: null }]);
    } finally {
      await prisma.$disconnect();
    }
  }, 120_000);

  it("does not block owner self-delete while the property cascade removes its reminder", async () => {
    const prisma = createDatabase();
    try {
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "User" ("id", "username", "password", "role")
        VALUES (1, 'synthetic-owner', 'unused', 'user')
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Property" ("id", "userId", "name") VALUES (1, 1, 'Synthetic')
      `);
      await seedReminder(prisma, 1, "owner");

      await expect(prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = 1`)).resolves.toBe(1);
      await expect(
        prisma.$queryRawUnsafe(`SELECT COUNT(*) AS "count" FROM "OperationalReminder"`),
      ).resolves.toEqual([{ count: 0 }]);
    } finally {
      await prisma.$disconnect();
    }
  }, 120_000);
});
