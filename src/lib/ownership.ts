/**
 * Centralized property access control.
 *
 * Three access levels per property:
 *   - owner: created the property; full control + can manage managers + delete
 *   - manager: granted access by owner; full daily operations (calendar, sync,
 *     overrides, reservations, guests, cleaning) — but cannot delete the
 *     property or manage other managers
 *   - cleaner: granted via CleanerAssignment; read-only access to the property
 *     and write access only on cleaning records for that property
 */

import { prisma } from "@/lib/prisma";

export type AccessLevel = "owner" | "manager" | "family" | "cleaner" | "none";

/**
 * Determine a user's access level to a property.
 */
export async function getPropertyAccess(
  propertyId: number,
  userId: number,
  role: string
): Promise<AccessLevel> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { userId: true },
  });
  if (!property) return "none";

  if (property.userId === userId) return "owner";

  // Manager check (full daily ops)
  let manager: { id: number; accessLevel?: string } | null = null;
  try {
    manager = await prisma.propertyManager.findUnique({
      where: { managerId_propertyId: { managerId: userId, propertyId } },
      select: { id: true, accessLevel: true },
    });
  } catch {
    // Backward-compatible read for pre-accessLevel databases during rollout.
    manager = await prisma.propertyManager.findUnique({
      where: { managerId_propertyId: { managerId: userId, propertyId } },
      select: { id: true },
    });
  }
  if (manager) return manager.accessLevel === "family" ? "family" : "manager";

  // Cleaner check (read-only + cleaning record writes)
  if (role === "cleaner") {
    const assignment = await prisma.cleanerAssignment.findUnique({
      where: { cleanerId_propertyId: { cleanerId: userId, propertyId } },
      select: { id: true },
    });
    if (assignment) return "cleaner";
  }

  return "none";
}

/**
 * True if user can perform daily management actions: edit reservations,
 * sync calendars, set overrides, edit settings (NOT delete the property
 * itself, NOT manage other managers).
 */
export async function canManageProperty(
  propertyId: number,
  userId: number,
  role: string
): Promise<boolean> {
  const access = await getPropertyAccess(propertyId, userId, role);
  return access === "owner" || access === "manager" || access === "family";
}

/**
 * True only for the owner and real managers.
 *
 * `canManageProperty` deliberately includes family access: relatives are
 * meant to add a stay and keep the calendar honest. They are not meant to
 * reach revenue, guest identity data, or the settings that decide what
 * the portals may sell — a UI that hides those is a courtesy, not a
 * boundary, so the routes behind them ask this instead.
 */
export async function canAdministerProperty(
  propertyId: number,
  userId: number,
  role: string
): Promise<boolean> {
  const access = await getPropertyAccess(propertyId, userId, role);
  return access === "owner" || access === "manager";
}

/**
 * True if user can read property data (calendar, reservations, etc).
 * Includes cleaners (who can see assigned properties read-only).
 */
export async function canReadProperty(
  propertyId: number,
  userId: number,
  role: string
): Promise<boolean> {
  const access = await getPropertyAccess(propertyId, userId, role);
  return access !== "none";
}

/**
 * Access level per property for a list endpoint, in two queries instead
 * of one round trip per row. Anything the caller cannot place stays out
 * of the map, so callers can fail closed.
 */
export async function propertyAccessLevels(
  userId: number,
  propertyIds: number[],
): Promise<Map<number, AccessLevel>> {
  const levels = new Map<number, AccessLevel>();
  if (propertyIds.length === 0) return levels;

  const owned = await prisma.property.findMany({
    where: { id: { in: propertyIds }, userId },
    select: { id: true },
  });
  for (const property of owned) levels.set(property.id, "owner");

  const managed = await prisma.propertyManager
    .findMany({
      where: { managerId: userId, propertyId: { in: propertyIds } },
      select: { propertyId: true, accessLevel: true },
    })
    .catch(() => [] as Array<{ propertyId: number; accessLevel?: string }>);
  for (const row of managed) {
    // Owning it outranks a manager row on the same property.
    if (levels.get(row.propertyId) === "owner") continue;
    levels.set(row.propertyId, row.accessLevel === "family" ? "family" : "manager");
  }

  return levels;
}

/**
 * True if user owns the property (only the owner can delete or manage managers).
 */
export async function isPropertyOwner(
  propertyId: number,
  userId: number
): Promise<boolean> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { userId: true },
  });
  return !!property && property.userId === userId;
}

/**
 * Get all property IDs accessible to a user (as owner OR manager OR cleaner).
 * Used for list endpoints.
 */
export async function listAccessiblePropertyIds(
  userId: number,
  role: string
): Promise<number[]> {
  const ids = new Set<number>();

  // Owned
  const owned = await prisma.property.findMany({
    where: { userId },
    select: { id: true },
  });
  for (const p of owned) ids.add(p.id);

  // Managed
  const managed = await prisma.propertyManager.findMany({
    where: { managerId: userId },
    select: { propertyId: true },
  }).catch(() => []);
  for (const m of managed) ids.add(m.propertyId);

  // Cleaning assignments (only for cleaner role; in normal role we don't surface cleaner-only props)
  if (role === "cleaner") {
    const assigned = await prisma.cleanerAssignment.findMany({
      where: { cleanerId: userId },
      select: { propertyId: true },
    });
    for (const a of assigned) ids.add(a.propertyId);
  }

  return Array.from(ids);
}

/**
 * Get all property IDs a user may mutate (owner or manager only).
 *
 * Keep this separate from listAccessiblePropertyIds(): cleaners are allowed to
 * read their assigned calendars, but must never be able to turn that read
 * access into a calendar import/write operation.
 */
export async function listManageablePropertyIds(userId: number): Promise<number[]> {
  const ids = new Set<number>();

  const owned = await prisma.property.findMany({
    where: { userId },
    select: { id: true },
  });
  for (const property of owned) ids.add(property.id);

  const managed = await prisma.propertyManager.findMany({
    where: { managerId: userId },
    select: { propertyId: true },
  }).catch(() => []);
  for (const assignment of managed) ids.add(assignment.propertyId);

  return Array.from(ids);
}
