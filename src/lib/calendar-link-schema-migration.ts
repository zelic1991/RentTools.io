import type { PrismaClient } from "../generated/prisma/client";

type TableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | number | null;
  pk: number;
  hidden: number;
};

type TableSqlRow = { sql: string | null };

type SchemaObjectRow = {
  type: "index" | "trigger";
  name: string;
  sql: string | null;
};

type CountRow = { count: number | bigint };
type SequenceRow = { seq: number | bigint };

export type CalendarLinkDefaultMigrationResult = {
  status: "migrated" | "noop";
  rowCount: number;
  preservedIndexes: number;
  preservedTriggers: number;
};

const EXPECTED_COLUMNS = [
  "id",
  "propertyId",
  "platform",
  "icalExportUrl",
  "bufferBefore",
  "bufferAfter",
  "lastFetchedAt",
  "lastError",
  "createdAt",
  "failureCount",
] as const;

const COLUMN_LIST = EXPECTED_COLUMNS.map((column) => `"${column}"`).join(", ");
const REBUILD_TABLE = "CalendarLink__default0_rebuild";

const EXPECTED_LEGACY_COLUMN_SHAPE = [
  { name: "id", type: "INTEGER", notnull: 1, dflt_value: null, pk: 1, hidden: 0 },
  { name: "propertyId", type: "INTEGER", notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
  { name: "platform", type: "TEXT", notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
  { name: "icalExportUrl", type: "TEXT", notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
  { name: "bufferBefore", type: "INTEGER", notnull: 1, dflt_value: "1", pk: 0, hidden: 0 },
  { name: "bufferAfter", type: "INTEGER", notnull: 1, dflt_value: "1", pk: 0, hidden: 0 },
  { name: "lastFetchedAt", type: "DATETIME", notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
  { name: "lastError", type: "TEXT", notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
  {
    name: "createdAt",
    type: "DATETIME",
    notnull: 1,
    dflt_value: "CURRENT_TIMESTAMP",
    pk: 0,
    hidden: 0,
  },
  { name: "failureCount", type: "INTEGER", notnull: 1, dflt_value: "0", pk: 0, hidden: 0 },
] as const;

const LEGACY_TABLE_SQL = `
  CREATE TABLE "CalendarLink" (
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
`;

function normalizeSqlDefault(value: string | number | null): string | null {
  if (value === null) return null;
  let normalized = String(value).trim();
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (
    (normalized.startsWith("'") && normalized.endsWith("'")) ||
    (normalized.startsWith('"') && normalized.endsWith('"'))
  ) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function normalizeCreateTableSql(value: string): string {
  return value
    .trim()
    .replace(/;$/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1");
}

const EXPECTED_LEGACY_TABLE_SQL = normalizeCreateTableSql(LEGACY_TABLE_SQL);

function asNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function quoteSqliteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * Align the persistent SQLite defaults with the application contract.
 *
 * Existing CalendarLink row values are copied verbatim. The rebuild only runs
 * for the one known legacy shape (DEFAULT 1/1); an unexpected shape fails
 * closed so a future column, constraint, or reference cannot be lost silently.
 */
export async function alignCalendarLinkBufferDefaults(
  prisma: PrismaClient,
): Promise<CalendarLinkDefaultMigrationResult> {
  const columns = await prisma.$queryRawUnsafe<TableInfoRow[]>(
    `PRAGMA table_xinfo("CalendarLink")`,
  );
  if (columns.length === 0) {
    throw new Error("CalendarLink table is missing");
  }

  const before = columns.find((column) => column.name === "bufferBefore");
  const after = columns.find((column) => column.name === "bufferAfter");
  const beforeDefault = normalizeSqlDefault(before?.dflt_value ?? null);
  const afterDefault = normalizeSqlDefault(after?.dflt_value ?? null);
  const rowCountRows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count FROM "CalendarLink"`,
  );
  const rowCount = asNumber(rowCountRows[0]?.count ?? 0);

  if (beforeDefault === "0" && afterDefault === "0") {
    return { status: "noop", rowCount, preservedIndexes: 0, preservedTriggers: 0 };
  }
  if (beforeDefault !== "1" || afterDefault !== "1") {
    throw new Error(
      `Unexpected CalendarLink buffer defaults: ${beforeDefault ?? "NULL"}/${afterDefault ?? "NULL"}`,
    );
  }

  const actualColumnShape = columns.map((column) => ({
    name: column.name,
    type: column.type.toUpperCase(),
    notnull: column.notnull,
    dflt_value: normalizeSqlDefault(column.dflt_value),
    pk: column.pk,
    hidden: column.hidden,
  }));
  if (JSON.stringify(actualColumnShape) !== JSON.stringify(EXPECTED_LEGACY_COLUMN_SHAPE)) {
    throw new Error("Unexpected CalendarLink column shape; refusing unsafe rebuild");
  }

  const tableSqlRows = await prisma.$queryRawUnsafe<TableSqlRow[]>(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'CalendarLink'`,
  );
  if (
    tableSqlRows.length !== 1 ||
    tableSqlRows[0].sql === null ||
    normalizeCreateTableSql(tableSqlRows[0].sql) !== EXPECTED_LEGACY_TABLE_SQL
  ) {
    throw new Error("Unexpected CalendarLink table definition; refusing unsafe rebuild");
  }

  const candidateTables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table'
       AND name <> 'CalendarLink' COLLATE NOCASE
       AND name NOT LIKE 'sqlite_%'`,
  );
  const referencingTables: string[] = [];
  for (const table of candidateTables) {
    const foreignKeys = await prisma.$queryRawUnsafe<Array<{ table: string }>>(
      `PRAGMA foreign_key_list(${quoteSqliteIdentifier(table.name)})`,
    );
    if (foreignKeys.some((foreignKey) => foreignKey.table.toLowerCase() === "calendarlink")) {
      referencingTables.push(table.name);
    }
  }
  if (referencingTables.length > 0) {
    throw new Error("CalendarLink has referencing tables; refusing unsafe rebuild");
  }

  const schemaObjects = await prisma.$queryRawUnsafe<SchemaObjectRow[]>(
    `SELECT type, name, sql FROM sqlite_master
     WHERE tbl_name = 'CalendarLink' COLLATE NOCASE
       AND type IN ('index', 'trigger')
     ORDER BY type, name`,
  );
  if (schemaObjects.some((entry) => entry.sql === null)) {
    throw new Error("CalendarLink has an implicit constraint index; refusing unsafe rebuild");
  }

  const foreignKeys = await prisma.$queryRawUnsafe<
    Array<{
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
    }>
  >(`PRAGMA foreign_key_list("CalendarLink")`);
  if (
    foreignKeys.length !== 1 ||
    foreignKeys[0].table !== "Property" ||
    foreignKeys[0].from !== "propertyId" ||
    foreignKeys[0].to !== "id" ||
    foreignKeys[0].on_update.toUpperCase() !== "CASCADE" ||
    foreignKeys[0].on_delete.toUpperCase() !== "CASCADE"
  ) {
    throw new Error("Unexpected CalendarLink foreign-key contract");
  }

  const staleRebuild = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    REBUILD_TABLE,
  );
  if (staleRebuild.length > 0) {
    throw new Error(`${REBUILD_TABLE} already exists; refusing to overwrite it`);
  }

  const sequenceRows = await prisma.$queryRawUnsafe<SequenceRow[]>(
    `SELECT seq FROM sqlite_sequence WHERE name = 'CalendarLink'`,
  );
  const originalSequence = sequenceRows.length > 0 ? asNumber(sequenceRows[0].seq) : null;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      CREATE TABLE "${REBUILD_TABLE}" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "propertyId" INTEGER NOT NULL,
        "platform" TEXT NOT NULL,
        "icalExportUrl" TEXT NOT NULL,
        "bufferBefore" INTEGER NOT NULL DEFAULT 0,
        "bufferAfter" INTEGER NOT NULL DEFAULT 0,
        "lastFetchedAt" DATETIME,
        "lastError" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "failureCount" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "CalendarLink_propertyId_fkey"
          FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await tx.$executeRawUnsafe(
      `INSERT INTO "${REBUILD_TABLE}" (${COLUMN_LIST})
       SELECT ${COLUMN_LIST} FROM "CalendarLink"`,
    );

    const copiedCountRows = await tx.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*) AS count FROM "${REBUILD_TABLE}"`,
    );
    if (asNumber(copiedCountRows[0]?.count ?? 0) !== rowCount) {
      throw new Error("CalendarLink row count changed during rebuild");
    }

    const missingFromCopy = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${COLUMN_LIST} FROM "CalendarLink"
       EXCEPT SELECT ${COLUMN_LIST} FROM "${REBUILD_TABLE}"`,
    );
    const addedByCopy = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${COLUMN_LIST} FROM "${REBUILD_TABLE}"
       EXCEPT SELECT ${COLUMN_LIST} FROM "CalendarLink"`,
    );
    if (missingFromCopy.length > 0 || addedByCopy.length > 0) {
      throw new Error("CalendarLink row values changed during rebuild");
    }

    await tx.$executeRawUnsafe(`DROP TABLE "CalendarLink"`);
    await tx.$executeRawUnsafe(
      `ALTER TABLE "${REBUILD_TABLE}" RENAME TO "CalendarLink"`,
    );

    for (const entry of schemaObjects) {
      await tx.$executeRawUnsafe(entry.sql!);
    }

    if (originalSequence !== null) {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE sqlite_sequence SET seq = ? WHERE name = 'CalendarLink'`,
        originalSequence,
      );
      if (updated === 0) {
        await tx.$executeRawUnsafe(
          `INSERT INTO sqlite_sequence(name, seq) VALUES ('CalendarLink', ?)`,
          originalSequence,
        );
      }
    }

    const foreignKeyViolations = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `PRAGMA foreign_key_check`,
    );
    if (foreignKeyViolations.length > 0) {
      throw new Error("Foreign-key integrity failed after CalendarLink rebuild");
    }
  });

  const finalColumns = await prisma.$queryRawUnsafe<TableInfoRow[]>(
    `PRAGMA table_xinfo("CalendarLink")`,
  );
  const finalBefore = normalizeSqlDefault(
    finalColumns.find((column) => column.name === "bufferBefore")?.dflt_value ?? null,
  );
  const finalAfter = normalizeSqlDefault(
    finalColumns.find((column) => column.name === "bufferAfter")?.dflt_value ?? null,
  );
  if (finalBefore !== "0" || finalAfter !== "0") {
    throw new Error("CalendarLink defaults were not repaired");
  }

  return {
    status: "migrated",
    rowCount,
    preservedIndexes: schemaObjects.filter((entry) => entry.type === "index").length,
    preservedTriggers: schemaObjects.filter((entry) => entry.type === "trigger").length,
  };
}
