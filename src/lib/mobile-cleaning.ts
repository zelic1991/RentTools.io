import "server-only";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listAccessiblePropertyIds,
  listManageablePropertyIds,
} from "@/lib/ownership";
import {
  buildMobileCleaningTasks,
  type MobileCleaningRecordInput,
  type MobileCleaningTask,
} from "@/lib/mobile-cleaning-core";
import type { MobileAccessLevel } from "@/lib/mobile-operations-core";

type CleaningRecordStore = {
  findMany(args: unknown): Promise<MobileCleaningRecordInput[]>;
};

const cleaningRecords = prisma.cleaningRecord as unknown as CleaningRecordStore;

export interface MobileCleaningData {
  section: "cleaning";
  access: MobileAccessLevel;
  canWrite: boolean;
  selectedProperty: { id: number; name: string };
  tasks: MobileCleaningTask[];
}

export async function loadMobileCleaning(): Promise<MobileCleaningData> {
  const session = await getSession();
  if (!session) redirect("/login?next=/mobile/cleaning");

  const propertyIds = session.role === "cleaner"
    ? await listAccessiblePropertyIds(session.userId, session.role)
    : await listManageablePropertyIds(session.userId);
  if (propertyIds.length === 0) redirect("/dashboard");

  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true, name: true, userId: true, managers: { where: { managerId: session.userId }, select: { accessLevel: true } } },
    orderBy: { name: "asc" },
  });
  if (properties.length === 0) redirect("/dashboard");

  const access: MobileAccessLevel = session.role === "cleaner"
    ? "cleaner"
    : properties.some((property) => property.managers.some((manager) => manager.accessLevel === "family"))
      ? "family"
      : properties.some((property) => property.userId === session.userId)
      ? "owner"
      : "manager";
  const records = await cleaningRecords.findMany({
    where: {
      propertyId: { in: properties.map((property) => property.id) },
      ...(access === "cleaner" ? { assignedCleanerId: session.userId } : {}),
    },
    orderBy: [{ date: "asc" }, { propertyId: "asc" }],
  });
  const assigneeIds = Array.from(new Set(
    records
      .map((record) => record.assignedCleanerId)
      .filter((id): id is number => id !== null),
  ));
  const assignees = assigneeIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, username: true },
      })
    : [];
  const tasks = buildMobileCleaningTasks({
    records,
    properties,
    assignees,
    access,
    viewerUserId: session.userId,
  });

  return {
    section: "cleaning",
    access,
    canWrite: access === "cleaner" && !session.impersonatorId,
    selectedProperty: {
      id: properties.length === 1 ? properties[0].id : 0,
      name: properties.length === 1 ? properties[0].name : `${properties.length} Objekte`,
    },
    tasks,
  };
}
