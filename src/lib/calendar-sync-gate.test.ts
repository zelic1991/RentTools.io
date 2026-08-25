import { afterEach, describe, expect, it, vi } from "vitest";
import { withCalendarSyncGate } from "./calendar-sync-gate";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  delete (globalThis as typeof globalThis & {
    __renttoolsCalendarSyncTail?: Promise<void>;
  }).__renttoolsCalendarSyncTail;
});

describe("calendar sync gate", () => {
  it("runs differently scoped work FIFO with at most one active task", async () => {
    const firstMayFinish = deferred();
    const entered: string[] = [];
    let active = 0;
    let maxActive = 0;

    const first = withCalendarSyncGate(async () => {
      entered.push("all");
      active++;
      maxActive = Math.max(maxActive, active);
      await firstMayFinish.promise;
      active--;
      return "all-result";
    });
    const second = withCalendarSyncGate(async () => {
      entered.push("property-7");
      active++;
      maxActive = Math.max(maxActive, active);
      active--;
      return "property-result";
    });

    await vi.waitFor(() => expect(entered).toEqual(["all"]));
    firstMayFinish.resolve();

    await expect(first).resolves.toBe("all-result");
    await expect(second).resolves.toBe("property-result");
    expect(entered).toEqual(["all", "property-7"]);
    expect(maxActive).toBe(1);
  });

  it("releases the queue after a failed task", async () => {
    const failed = withCalendarSyncGate(async () => {
      throw new Error("synthetic failure");
    });
    const next = withCalendarSyncGate(async () => "recovered");

    await expect(failed).rejects.toThrow("synthetic failure");
    await expect(next).resolves.toBe("recovered");
  });

  it("shares the gate across module reloads", async () => {
    const firstMayFinish = deferred();
    const entered: string[] = [];
    const first = withCalendarSyncGate(async () => {
      entered.push("first-module");
      await firstMayFinish.promise;
    });

    await vi.waitFor(() => expect(entered).toEqual(["first-module"]));
    vi.resetModules();
    const reloaded = await import("./calendar-sync-gate");
    const second = reloaded.withCalendarSyncGate(async () => {
      entered.push("reloaded-module");
    });

    await Promise.resolve();
    expect(entered).toEqual(["first-module"]);
    firstMayFinish.resolve();
    await Promise.all([first, second]);
    expect(entered).toEqual(["first-module", "reloaded-module"]);
  });
});
