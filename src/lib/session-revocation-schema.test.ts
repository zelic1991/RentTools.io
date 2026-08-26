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
  tempRoot = await mkdtemp(path.join(tmpdir(), "renttools-session-version-"));
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
  await legacy.$executeRawUnsafe(
    `INSERT INTO "User" ("id", "username", "password") VALUES (1, 'legacy-owner', 'hash')`,
  );
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
      // libSQL can hold the disposable file until the worker exits on Windows.
      if (!(process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EBUSY")) {
        throw error;
      }
    }
  }
});

describe("sessionVersion schema upgrade", () => {
  it("adds an idempotent zero default without invalidating legacy accounts", async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ sessionVersion: number }>>(
      `SELECT "sessionVersion" FROM "User" WHERE "id" = 1`,
    );
    expect(Number(rows[0].sessionVersion)).toBe(0);
  });
});
