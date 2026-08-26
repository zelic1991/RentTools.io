import { describe, expect, it } from "vitest";
import {
  buildMobileCleaningTasks,
  cleanerCleaningActions,
} from "@/lib/mobile-cleaning-core";

const records = [
  { id: 1, propertyId: 10, date: "2026-09-02", status: "ASSIGNED", notes: "Terrasse", assignedCleanerId: 7 },
  { id: 2, propertyId: 10, date: "2026-09-03", status: "READY", notes: "", assignedCleanerId: 7 },
  { id: 3, propertyId: 11, date: "2026-09-01", status: "IN_PROGRESS", notes: "Bad", assignedCleanerId: 8 },
  { id: 4, propertyId: 99, date: "2026-09-01", status: "ISSUE", notes: "Foreign", assignedCleanerId: 7 },
];

describe("mobile cleaning DTO authority", () => {
  it("returns only open, server-scoped tasks assigned to the cleaner", () => {
    expect(buildMobileCleaningTasks({
      records,
      properties: [
        { id: 10, name: "Haus A" },
        { id: 11, name: "Haus B" },
      ],
      assignees: [
        { id: 7, username: "Ana" },
        { id: 8, username: "Mira" },
      ],
      access: "cleaner",
      viewerUserId: 7,
    })).toEqual([{
      id: 1,
      propertyId: 10,
      propertyName: "Haus A",
      date: "2026-09-02",
      status: "ASSIGNED",
      notes: "Terrasse",
      assignedCleanerId: 7,
      assigneeName: "Ana",
    }]);
  });

  it("lets management view open tasks across its scoped properties", () => {
    const tasks = buildMobileCleaningTasks({
      records,
      properties: [{ id: 10, name: "Haus A" }, { id: 11, name: "Haus B" }],
      assignees: [{ id: 7, username: "Ana" }, { id: 8, username: "Mira" }],
      access: "manager",
      viewerUserId: 3,
    });
    expect(tasks.map((task) => task.id)).toEqual([3, 1]);
  });
});

describe("cleaner action visibility", () => {
  it("shows only transitions owned by the cleaner state machine", () => {
    expect(cleanerCleaningActions("ASSIGNED").map((action) => action.status)).toEqual(["IN_PROGRESS"]);
    expect(cleanerCleaningActions("IN_PROGRESS").map((action) => action.status)).toEqual(["READY", "ISSUE"]);
    expect(cleanerCleaningActions("PLANNED")).toEqual([]);
    expect(cleanerCleaningActions("READY")).toEqual([]);
    expect(cleanerCleaningActions("ISSUE")).toEqual([]);
  });
});
