import {
  canonicalCleaningStatus,
  type CleaningStatus,
} from "@/lib/cleaning-workflow";

export interface MobileCleaningRecordInput {
  id: number;
  propertyId: number;
  date: string;
  status: string;
  notes: string;
  assignedCleanerId: number | null;
}

export interface MobileCleaningTask {
  id: number;
  propertyId: number;
  propertyName: string;
  date: string;
  status: CleaningStatus;
  notes: string;
  assignedCleanerId: number | null;
  assigneeName: string;
}

export interface CleanerCleaningAction {
  status: "IN_PROGRESS" | "READY" | "ISSUE";
  label: string;
  tone: "primary" | "success" | "danger";
}

/** Pure projection used by the server loader and focused authority tests. */
export function buildMobileCleaningTasks(options: {
  records: MobileCleaningRecordInput[];
  properties: Array<{ id: number; name: string }>;
  assignees: Array<{ id: number; username: string }>;
  access: "owner" | "manager" | "family" | "cleaner";
  viewerUserId: number;
}): MobileCleaningTask[] {
  const properties = new Map(options.properties.map((property) => [property.id, property.name]));
  const assignees = new Map(options.assignees.map((user) => [user.id, user.username]));

  return options.records
    .filter((record) => properties.has(record.propertyId))
    .filter((record) =>
      options.access !== "cleaner" || record.assignedCleanerId === options.viewerUserId,
    )
    .map((record) => ({
      record,
      status: canonicalCleaningStatus(record.status) ?? "ISSUE",
    }))
    .filter(({ status }) => status !== "READY")
    .map(({ record, status }) => ({
      id: record.id,
      propertyId: record.propertyId,
      propertyName: properties.get(record.propertyId)!,
      date: record.date,
      status,
      notes: record.notes,
      assignedCleanerId: record.assignedCleanerId,
      assigneeName: record.assignedCleanerId
        ? assignees.get(record.assignedCleanerId) ?? "Zugewiesen"
        : "Nicht zugewiesen",
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.propertyName.localeCompare(b.propertyName));
}

export function cleanerCleaningActions(status: CleaningStatus): CleanerCleaningAction[] {
  if (status === "ASSIGNED") {
    return [{ status: "IN_PROGRESS", label: "Starten", tone: "primary" }];
  }
  if (status === "IN_PROGRESS") {
    return [
      { status: "READY", label: "Fertig", tone: "success" },
      { status: "ISSUE", label: "Problem", tone: "danger" },
    ];
  }
  return [];
}
