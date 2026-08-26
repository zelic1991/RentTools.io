import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";

describe("first-customer three-owner authority graph", () => {
  let prisma: PrismaClient;

  beforeEach(async () => {
    vi.resetModules();
    const adapter = new PrismaLibSql({ url: "file::memory:?cache=private" });
    prisma = new PrismaClient({ adapter });

    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Property" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "name" TEXT NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "PropertyManager" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "managerId" INTEGER NOT NULL,
        "propertyId" INTEGER NOT NULL,
        "accessLevel" TEXT NOT NULL DEFAULT 'manager',
        UNIQUE("managerId", "propertyId")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CleanerAssignment" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "cleanerId" INTEGER,
        "propertyId" INTEGER NOT NULL,
        UNIQUE("cleanerId", "propertyId")
      )
    `);

    // Three independent synthetic owners, each with two apartments/Properties.
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Property" (id, userId, name) VALUES
        (11, 1, 'Owner A Apartment 1'),
        (12, 1, 'Owner A Apartment 2'),
        (21, 2, 'Owner B Apartment 1'),
        (22, 2, 'Owner B Apartment 2'),
        (31, 3, 'Owner C Apartment 1'),
        (32, 3, 'Owner C Apartment 2')
    `);
    // Manager 50 is deliberately assigned across two owners, but not Owner B.
    await prisma.$executeRawUnsafe(`
      INSERT INTO "PropertyManager" (id, managerId, propertyId) VALUES
        (101, 50, 12),
        (102, 50, 31)
    `);
    await prisma.$executeRawUnsafe(
      `UPDATE "PropertyManager" SET accessLevel = 'family' WHERE managerId = 50 AND propertyId = 12`,
    );
    // Cleaner 60 is deliberately assigned across Owner A and Owner B.
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CleanerAssignment" (id, cleanerId, propertyId) VALUES
        (201, 60, 11),
        (202, 60, 21)
    `);

    vi.doMock("@/lib/prisma", () => ({ prisma }));
  });

  afterEach(async () => {
    vi.doUnmock("@/lib/prisma");
    await prisma.$disconnect();
  });

  it("isolates owners and grants a manager only explicitly assigned apartments", async () => {
    const {
      canManageProperty,
      getPropertyAccess,
      listAccessiblePropertyIds,
      listManageablePropertyIds,
    } = await import("./ownership");

    await expect(listManageablePropertyIds(1)).resolves.toEqual([11, 12]);
    await expect(listManageablePropertyIds(2)).resolves.toEqual([21, 22]);
    await expect(listManageablePropertyIds(3)).resolves.toEqual([31, 32]);
    await expect(canManageProperty(21, 1, "user")).resolves.toBe(false);
    await expect(getPropertyAccess(32, 2, "user")).resolves.toBe("none");

    await expect(listManageablePropertyIds(50)).resolves.toEqual([12, 31]);
    await expect(listAccessiblePropertyIds(50, "manager")).resolves.toEqual([12, 31]);
    await expect(getPropertyAccess(12, 50, "manager")).resolves.toBe("family");
    await expect(getPropertyAccess(31, 50, "manager")).resolves.toBe("manager");
    await expect(getPropertyAccess(21, 50, "manager")).resolves.toBe("none");
  });

  it("keeps cleaner scope read-only and applies assignment revocation immediately", async () => {
    const {
      canManageProperty,
      getPropertyAccess,
      listAccessiblePropertyIds,
      listManageablePropertyIds,
    } = await import("./ownership");

    await expect(listAccessiblePropertyIds(60, "cleaner")).resolves.toEqual([11, 21]);
    await expect(listManageablePropertyIds(60)).resolves.toEqual([]);
    await expect(canManageProperty(11, 60, "cleaner")).resolves.toBe(false);
    await expect(getPropertyAccess(21, 60, "cleaner")).resolves.toBe("cleaner");

    await prisma.$executeRawUnsafe(
      `DELETE FROM "CleanerAssignment" WHERE cleanerId = 60 AND propertyId = 21`,
    );

    await expect(getPropertyAccess(21, 60, "cleaner")).resolves.toBe("none");
    await expect(listAccessiblePropertyIds(60, "cleaner")).resolves.toEqual([11]);
  });
});
