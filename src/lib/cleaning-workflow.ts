export const CLEANING_STATUSES = [
  "PLANNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "READY",
  "ISSUE",
] as const;

export type CleaningStatus = (typeof CLEANING_STATUSES)[number];
export type CleaningActor = "manager" | "cleaner";

const STATUS_ALIASES: Record<string, CleaningStatus> = {
  planned: "PLANNED",
  pending: "PLANNED",
  assigned: "ASSIGNED",
  in_progress: "IN_PROGRESS",
  ready: "READY",
  done: "READY",
  issue: "ISSUE",
  skipped: "ISSUE",
};

/** Normalize both current API values and the three pre-workflow legacy values. */
export function canonicalCleaningStatus(value: unknown): CleaningStatus | null {
  if (typeof value !== "string") return null;
  return STATUS_ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * Management owns planning/assignment and can restart an ISSUE. Cleaners own
 * only the operational part of a task. ISSUE -> ASSIGNED is the explicit
 * remediation loop; there are no terminal-state rewrites.
 */
export function canTransitionCleaning(
  current: CleaningStatus | null,
  target: CleaningStatus,
  actor: CleaningActor,
): boolean {
  if (actor === "cleaner") {
    return (
      (current === "ASSIGNED" && target === "IN_PROGRESS") ||
      (current === "IN_PROGRESS" && (target === "READY" || target === "ISSUE"))
    );
  }

  return (
    (current === null && target === "PLANNED") ||
    (current === "PLANNED" && target === "ASSIGNED") ||
    (current === "ASSIGNED" && target === "ASSIGNED") ||
    (current === "ISSUE" && (target === "PLANNED" || target === "ASSIGNED"))
  );
}
