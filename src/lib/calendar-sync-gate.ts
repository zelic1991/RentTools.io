type CalendarSyncGlobal = typeof globalThis & {
  __renttoolsCalendarSyncTail?: Promise<void>;
};

const syncGlobal = globalThis as CalendarSyncGlobal;

/**
 * Serialize calendar syncs inside the single `next start` process.
 *
 * Cron and manual sync use the same gate, so their differently scoped work is
 * queued FIFO instead of being merged, dropped, or run concurrently. The
 * state lives on globalThis so separate Next.js route bundles still share it.
 * A multi-process/replicated deployment would additionally need a DB lease.
 */
export async function withCalendarSyncGate<T>(task: () => Promise<T>): Promise<T> {
  const previous = syncGlobal.__renttoolsCalendarSyncTail ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  syncGlobal.__renttoolsCalendarSyncTail = tail;

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (syncGlobal.__renttoolsCalendarSyncTail === tail) {
      delete syncGlobal.__renttoolsCalendarSyncTail;
    }
  }
}
