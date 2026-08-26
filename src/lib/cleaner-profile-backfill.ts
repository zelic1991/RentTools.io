import type { PrismaClient } from "../generated/prisma/client";

type RawDatabase = Pick<
  PrismaClient,
  "$queryRawUnsafe" | "$executeRawUnsafe"
>;

export type CleanerProfileBackfillResult = {
  createdProfiles: number;
  reusedProfiles: number;
  updatedAssignments: number;
};

/**
 * Backfill login-capable legacy cleaners into owner-scoped Cleaner profiles.
 *
 * A legacy cleaner User may serve properties belonging to several owners. The
 * Cleaner profile is account metadata, so each owner needs a separate profile
 * and only assignments for that owner's properties may point to it.
 *
 * Existing owner-correct links are preserved, including profiles whose name or
 * phone was edited after the original backfill. Missing and cross-owner links
 * are repaired. Profile-only assignments (cleanerId = NULL) are not touched.
 */
export async function backfillCleanerProfilesByOwner(
  database: RawDatabase,
  log: (message: string) => void = () => undefined,
): Promise<CleanerProfileBackfillResult> {
  const result: CleanerProfileBackfillResult = {
    createdProfiles: 0,
    reusedProfiles: 0,
    updatedAssignments: 0,
  };

  const cleanerUsers = await database.$queryRawUnsafe<
    Array<{ id: number; username: string }>
  >(`SELECT id, username FROM "User" WHERE role = 'cleaner'`);

  for (const cleanerUser of cleanerUsers) {
    const owners = await database.$queryRawUnsafe<Array<{ ownerUserId: number }>>(
      `SELECT DISTINCT p.userId AS ownerUserId
       FROM "CleanerAssignment" ca
       INNER JOIN "Property" p ON p.id = ca.propertyId
       WHERE ca.cleanerId = ?
       ORDER BY p.userId ASC`,
      cleanerUser.id,
    );

    for (const { ownerUserId } of owners) {
      // Prefer a profile already attached to this cleaner on one of this
      // owner's properties. This preserves later profile edits on reruns.
      const attachedProfile = await database.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT c.id
         FROM "Cleaner" c
         INNER JOIN "CleanerAssignment" ca ON ca.cleanerProfileId = c.id
         INNER JOIN "Property" p ON p.id = ca.propertyId
         WHERE ca.cleanerId = ?
           AND p.userId = ?
           AND c.ownerUserId = ?
         ORDER BY ca.createdAt ASC, c.id ASC
         LIMIT 1`,
        cleanerUser.id,
        ownerUserId,
        ownerUserId,
      );

      let profileId = attachedProfile[0]?.id;
      if (profileId === undefined) {
        const profileByName = await database.$queryRawUnsafe<Array<{ id: number }>>(
          `SELECT id FROM "Cleaner"
           WHERE ownerUserId = ? AND name = ?
           ORDER BY id ASC
           LIMIT 1`,
          ownerUserId,
          cleanerUser.username,
        );
        profileId = profileByName[0]?.id;
      }

      if (profileId === undefined) {
        await database.$executeRawUnsafe(
          `INSERT INTO "Cleaner" ("ownerUserId", "name", "phone")
           VALUES (?, ?, NULL)`,
          ownerUserId,
          cleanerUser.username,
        );
        const inserted = await database.$queryRawUnsafe<Array<{ id: number }>>(
          `SELECT id FROM "Cleaner"
           WHERE ownerUserId = ? AND name = ?
           ORDER BY id DESC
           LIMIT 1`,
          ownerUserId,
          cleanerUser.username,
        );
        profileId = inserted[0]?.id;
        if (profileId === undefined) {
          throw new Error(
            `Cleaner profile insert could not be read back for owner ${ownerUserId}`,
          );
        }
        result.createdProfiles += 1;
        log(
          `OK: backfilled Cleaner profile for user ${cleanerUser.username} ` +
            `(id=${cleanerUser.id}, owner=${ownerUserId}) -> profile ${profileId}`,
        );
      } else {
        result.reusedProfiles += 1;
      }

      // Repair only this owner's legacy assignments. A link is changed only
      // when it is missing or points at a profile owned by somebody else.
      const updated = await database.$executeRawUnsafe(
        `UPDATE "CleanerAssignment"
         SET cleanerProfileId = ?
         WHERE cleanerId = ?
           AND propertyId IN (
             SELECT id FROM "Property" WHERE userId = ?
           )
           AND (
             cleanerProfileId IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM "Cleaner" c
               WHERE c.id = "CleanerAssignment".cleanerProfileId
                 AND c.ownerUserId = ?
             )
           )`,
        profileId,
        cleanerUser.id,
        ownerUserId,
        ownerUserId,
      );
      result.updatedAssignments += updated;
    }
  }

  return result;
}
