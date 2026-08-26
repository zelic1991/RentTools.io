import { describe, expect, it } from "vitest";
import {
  canTransitionCleaning,
  canonicalCleaningStatus,
  type CleaningStatus,
} from "@/lib/cleaning-workflow";

describe("cleaning workflow compatibility", () => {
  it.each([
    ["pending", "PLANNED"],
    ["done", "READY"],
    ["skipped", "ISSUE"],
    ["in_progress", "IN_PROGRESS"],
    ["READY", "READY"],
  ])("maps %s to %s", (input, expected) => {
    expect(canonicalCleaningStatus(input)).toBe(expected);
  });

  it("rejects unknown statuses", () => {
    expect(canonicalCleaningStatus("finished")).toBeNull();
    expect(canonicalCleaningStatus(null)).toBeNull();
  });
});

describe("cleaning transition policy", () => {
  it.each<[CleaningStatus | null, CleaningStatus]>([
    [null, "PLANNED"],
    ["PLANNED", "ASSIGNED"],
    ["ASSIGNED", "ASSIGNED"],
    ["ISSUE", "PLANNED"],
    ["ISSUE", "ASSIGNED"],
  ])("allows management transition %s -> %s", (current, target) => {
    expect(canTransitionCleaning(current, target, "manager")).toBe(true);
  });

  it.each<[CleaningStatus, CleaningStatus]>([
    ["ASSIGNED", "IN_PROGRESS"],
    ["IN_PROGRESS", "READY"],
    ["IN_PROGRESS", "ISSUE"],
  ])("allows cleaner transition %s -> %s", (current, target) => {
    expect(canTransitionCleaning(current, target, "cleaner")).toBe(true);
  });

  it.each<[CleaningStatus | null, CleaningStatus, "manager" | "cleaner"]>([
    [null, "ASSIGNED", "manager"],
    ["PLANNED", "IN_PROGRESS", "manager"],
    ["IN_PROGRESS", "READY", "manager"],
    ["PLANNED", "ASSIGNED", "cleaner"],
    ["ASSIGNED", "READY", "cleaner"],
    ["READY", "ISSUE", "cleaner"],
  ])("rejects %s -> %s for %s", (current, target, actor) => {
    expect(canTransitionCleaning(current, target, actor)).toBe(false);
  });
});
