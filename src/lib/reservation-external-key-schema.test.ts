import { PrismaLibSql } from "@prisma/adapter-libsql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "../generated/prisma/client";
import { buildDirectReservationExternalKey } from "./reservation-external-key";

let tempRoot = "";
let dbPath = "";
let prisma: PrismaClient;
let beforeCount = 0;

function connect(file: string): PrismaClient {
  const adapter = new PrismaLibSql({ url: `file:${file}` });
  return new PrismaClient({ adapter });
}

async function createLegacyFixture(): Promise<void> {
  const legacy = connect(dbPath);
  await legacy.$executeRawUnsafe(`
    CREATE TABLE "User" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "username" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'user',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await legacy.$executeRawUnsafe(`
    CREATE TABLE "Property" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL DEFAULT 1,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await legacy.$executeRawUnsafe(`
    CREATE TABLE "Reservation" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "checkIn" DATETIME NOT NULL,
      "checkOut" DATETIME NOT NULL,
      "platform" TEXT NOT NULL DEFAULT 'airbnb',
      "linkedEventUid" TEXT,
      "linkedEventPlatform" TEXT,
      "linkedEventRole" TEXT,
      "propertyId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await legacy.$executeRawUnsafe(
    `INSERT INTO "User" ("id", "username", "password", "role") VALUES (1, 'synthetic-owner', 'not-a-real-password', 'user')`,
  );
  await legacy.$executeRawUnsafe(
    `INSERT INTO "Property" ("id", "userId", "name") VALUES (1, 1, 'Synthetic Property')`,
  );
  await legacy.$executeRawUnsafe(
    `INSERT INTO "Property" ("id", "userId", "name") VALUES (2, 1, 'Other Synthetic Property')`,
  );
  await legacy.$executeRawUnsafe(
    `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId") VALUES ('Legacy A', '2027-01-01', '2027-01-02', 'direct', 1)`,
  );
  await legacy.$executeRawUnsafe(
    `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId") VALUES ('Legacy B', '2027-01-02', '2027-01-03', 'direct', 1)`,
  );
  const rows = await legacy.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM "Reservation"`,
  );
  beforeCount = Number(rows[0].count);
  await legacy.$disconnect();
}

beforeAll(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "renttools-external-key-"));
  dbPath = path.join(tempRoot, "legacy.db");
  await createLegacyFixture();

  const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsxCli, "prisma/push-schema.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}`, TURSO_DATABASE_URL: "" },
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `Isolated schema upgrade failed: ${result.error?.message ?? "unknown error"}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  prisma = connect(dbPath);
}, 150_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (tempRoot) {
    try {
      await rm(tempRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    } catch (error) {
      // libSQL on Windows can hold the throwaway file until the test worker
      // exits. The OS releases it with the process; this must not hide a
      // migration failure. Linux CI removes it synchronously.
      if (!(process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EBUSY")) {
        throw error;
      }
    }
  }
}, 30_000);

describe("Reservation externalKey schema upgrade", () => {
  it("adds the nullable field without changing old rows or row counts", async () => {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("Reservation")`,
    );
    expect(columns.map((column) => column.name)).toContain("externalKey");

    const counts = await prisma.$queryRawUnsafe<Array<{ total: number; nullKeys: number }>>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN "externalKey" IS NULL THEN 1 ELSE 0 END) AS nullKeys FROM "Reservation"`,
    );
    expect(Number(counts[0].total)).toBe(beforeCount);
    expect(Number(counts[0].nullKeys)).toBe(beforeCount);
  });

  it("permits multiple legacy NULL keys", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId", "externalKey") VALUES ('Legacy C', '2027-01-03', '2027-01-04', 'direct', 1, NULL)`,
      ),
    ).resolves.toBe(1);
  });

  it("rejects the same key within one property and platform", async () => {
    const key = "BOOKING:STABLE-1";
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId", "externalKey") VALUES ('Booking A', '2027-02-01', '2027-02-02', 'booking', 1, ?)`,
      key,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId", "externalKey") VALUES ('Booking duplicate', '2027-02-02', '2027-02-03', 'booking', 1, ?)`,
        key,
      ),
    ).rejects.toThrow();
  });

  it("allows the same key for another property or platform", async () => {
    const key = "SHARED-STABLE-KEY";
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId", "externalKey") VALUES ('Property 1', '2027-03-01', '2027-03-02', 'booking', 1, ?)`,
        key,
      ),
    ).resolves.toBe(1);
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId", "externalKey") VALUES ('Property 2', '2027-03-01', '2027-03-02', 'booking', 2, ?)`,
        key,
      ),
    ).resolves.toBe(1);
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId", "externalKey") VALUES ('Direct', '2027-03-02', '2027-03-03', 'direct', 1, ?)`,
        key,
      ),
    ).resolves.toBe(1);
  });

  it("makes a second dry-run identity lookup return no CREATE action", async () => {
    const externalKey = buildDirectReservationExternalKey({
      propertyId: 1,
      checkIn: "2027-04-01",
      checkOut: "2027-04-02",
      ownerSource: { kind: "owner-chat", recordedOn: "2026-08-25", sequence: 9 },
    });
    const wouldCreate = async (): Promise<boolean> => {
      const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*) AS count FROM "Reservation" WHERE "propertyId" = ? AND "platform" = ? AND "externalKey" = ?`,
        1,
        "direct",
        externalKey,
      );
      return Number(rows[0].count) === 0;
    };

    expect(await wouldCreate()).toBe(true);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Reservation" ("name", "checkIn", "checkOut", "platform", "propertyId", "externalKey") VALUES ('Direct dry run', '2027-04-01', '2027-04-02', 'direct', 1, ?)`,
      externalKey,
    );
    expect(await wouldCreate()).toBe(false);
  });

  it("keeps the linked-event index and passes SQLite integrity_check", async () => {
    const indexes = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA index_list("Reservation")`,
    );
    expect(indexes.map((index) => index.name)).toContain(
      "Reservation_propertyId_linkedEventPlatform_linkedEventUid_idx",
    );
    expect(indexes.map((index) => index.name)).toContain(
      "Reservation_propertyId_platform_externalKey_key",
    );
    const integrity = await prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>(
      `PRAGMA integrity_check`,
    );
    expect(integrity[0].integrity_check).toBe("ok");
  });
});
