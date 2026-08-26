import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import { backfillCleanerProfilesByOwner } from "./cleaner-profile-backfill";

describe("legacy cleaner profile backfill", () => {
  let prisma: PrismaClient;

  beforeEach(async () => {
    const adapter = new PrismaLibSql({
      url: "file::memory:?cache=private",
    });
    prisma = new PrismaClient({ adapter });

    await prisma.$executeRawUnsafe(`
      CREATE TABLE "User" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "username" TEXT NOT NULL,
        "role" TEXT NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Property" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "name" TEXT NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Cleaner" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "ownerUserId" INTEGER NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CleanerAssignment" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "cleanerId" INTEGER,
        "cleanerProfileId" INTEGER,
        "propertyId" INTEGER NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, username, role) VALUES
       (1, 'owner-a', 'user'),
       (2, 'owner-b', 'user'),
       (3, 'shared-cleaner', 'cleaner')`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Property" (id, userId, name) VALUES
       (11, 1, 'Owner A House'),
       (12, 1, 'Owner A Annex'),
       (21, 2, 'Owner B House')`,
    );
    // This is the shape produced by the former first-assignment backfill:
    // Owner A's profile was attached to a property belonging to Owner B.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Cleaner" (id, ownerUserId, name, phone)
       VALUES (101, 1, 'Shared Cleaner Renamed', '+385-owner-a')`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CleanerAssignment"
         (id, cleanerId, cleanerProfileId, propertyId, createdAt) VALUES
       (201, 3, 101, 11, '2026-01-01'),
       (202, 3, NULL, 12, '2026-01-02'),
       (203, 3, 101, 21, '2026-01-03')`,
    );
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it("creates one owner-scoped profile per owner and repairs only that owner's assignments", async () => {
    const firstRun = await backfillCleanerProfilesByOwner(prisma);

    expect(firstRun).toEqual({
      createdProfiles: 1,
      reusedProfiles: 1,
      updatedAssignments: 2,
    });

    const profiles = await prisma.$queryRawUnsafe<
      Array<{ id: number; ownerUserId: number; name: string; phone: string | null }>
    >(`SELECT id, ownerUserId, name, phone FROM "Cleaner" ORDER BY ownerUserId`);
    expect(profiles).toEqual([
      {
        id: 101,
        ownerUserId: 1,
        name: "Shared Cleaner Renamed",
        phone: "+385-owner-a",
      },
      {
        id: expect.any(Number),
        ownerUserId: 2,
        name: "shared-cleaner",
        phone: null,
      },
    ]);

    const assignments = await prisma.$queryRawUnsafe<
      Array<{
        propertyId: number;
        propertyOwnerId: number;
        cleanerProfileId: number;
        profileOwnerId: number;
      }>
    >(`
      SELECT
        ca.propertyId,
        p.userId AS propertyOwnerId,
        ca.cleanerProfileId,
        c.ownerUserId AS profileOwnerId
      FROM "CleanerAssignment" ca
      INNER JOIN "Property" p ON p.id = ca.propertyId
      INNER JOIN "Cleaner" c ON c.id = ca.cleanerProfileId
      ORDER BY ca.propertyId
    `);

    expect(assignments).toHaveLength(3);
    expect(assignments.every((row) => row.propertyOwnerId === row.profileOwnerId)).toBe(true);
    expect(assignments.filter((row) => row.propertyOwnerId === 1)).toEqual([
      expect.objectContaining({ propertyId: 11, cleanerProfileId: 101 }),
      expect.objectContaining({ propertyId: 12, cleanerProfileId: 101 }),
    ]);
    expect(assignments.find((row) => row.propertyId === 21)?.cleanerProfileId).not.toBe(101);

    // Preserve the previous single-owner behavior and edited metadata on rerun.
    const secondRun = await backfillCleanerProfilesByOwner(prisma);
    expect(secondRun).toEqual({
      createdProfiles: 0,
      reusedProfiles: 2,
      updatedAssignments: 0,
    });
    await expect(
      prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*) AS count FROM "Cleaner"`,
      ),
    ).resolves.toEqual([{ count: 2 }]);
  });
});
