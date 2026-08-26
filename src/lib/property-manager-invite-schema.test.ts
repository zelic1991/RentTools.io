import { PrismaLibSql } from "@prisma/adapter-libsql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "../generated/prisma/client";

let tempRoot = "";
let dbPath = "";
let prisma: PrismaClient;

beforeAll(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "renttools-invite-access-level-"));
  dbPath = path.join(tempRoot, "legacy.db");
  const legacy = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${dbPath}` }) });
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
      "userId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await legacy.$executeRawUnsafe(`
    CREATE TABLE "PropertyManagerInvite" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "propertyId" INTEGER NOT NULL,
      "token" TEXT NOT NULL,
      "createdById" INTEGER NOT NULL,
      "acceptedById" INTEGER,
      "acceptedAt" DATETIME,
      "expiresAt" DATETIME NOT NULL,
      "revokedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await legacy.$executeRawUnsafe(`INSERT INTO "User" ("id", "username", "password") VALUES (1, 'owner', 'hash')`);
  await legacy.$executeRawUnsafe(`INSERT INTO "Property" ("id", "userId", "name") VALUES (1, 1, 'Legacy')`);
  await legacy.$disconnect();

  const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  for (let pass = 1; pass <= 2; pass += 1) {
    const result = spawnSync(process.execPath, [tsxCli, "prisma/push-schema.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}`, TURSO_DATABASE_URL: "" },
      encoding: "utf8",
      timeout: 120_000,
    });
    if (result.status !== 0) {
      throw new Error(`Schema pass ${pass} failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    }
  }
  prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${dbPath}` }) });
}, 150_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (tempRoot) {
    try {
      await rm(tempRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    } catch (error) {
      if (!(process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EBUSY")) {
        throw error;
      }
    }
  }
});

describe("property manager invite schema upgrade", () => {
  it("adds accessLevel to an existing invite table and keeps schema pushes idempotent", async () => {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("PropertyManagerInvite")`,
    );
    expect(columns.map((column) => column.name)).toContain("accessLevel");

    const invite = await prisma.propertyManagerInvite.create({
      data: {
        propertyId: 1,
        createdById: 1,
        token: "family-invite-test-token",
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        accessLevel: "family",
      },
    });
    expect(invite.accessLevel).toBe("family");
  });
});
