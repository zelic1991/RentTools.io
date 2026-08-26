export const OPERATIONAL_REMINDER_TYPES = ["PORTAL_FOLLOW_UP"] as const;
export const OPERATIONAL_REMINDER_STATUSES = ["OPEN", "DONE"] as const;

export type OperationalReminderType = typeof OPERATIONAL_REMINDER_TYPES[number];
export type OperationalReminderStatus = typeof OPERATIONAL_REMINDER_STATUSES[number];

export interface OperationalReminderDto {
  id: number;
  propertyId: number;
  propertyName: string;
  type: OperationalReminderType;
  portal: string;
  status: OperationalReminderStatus;
  startDate: string;
  endDate: string;
  dueAt: string;
  note: string;
  completedAt: string | null;
  completedByUserId: number | null;
  createdAt: string;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseDueAt(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function operationalReminderDedupeKey(input: {
  propertyId: number;
  type: OperationalReminderType;
  portal: string;
  startDate: string;
  endDate: string;
}): string {
  return [
    input.propertyId,
    input.type,
    input.portal.trim().toLowerCase(),
    input.startDate,
    input.endDate,
  ].join("|");
}

export function isOpenOperationalReminder(value: { status: string }): boolean {
  return value.status === "OPEN";
}
