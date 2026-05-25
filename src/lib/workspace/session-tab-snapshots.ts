import {
  incMemoryCounter,
  decMemoryCounter,
  setMemoryCounter,
} from '../app/memory-counters';

export type SessionTabSnapshot = {
  readonly id: string;
};

export type SnapshotRetentionReason =
  | 'retention-expired'
  | 'retention-replaced'
  | 'retention-disabled'
  | 'tab-removed'
  | 'pane-destroyed';

export type SessionTabSnapshots<T extends SessionTabSnapshot> = ReturnType<
  typeof createSessionTabSnapshots<T>
>;

export function createSessionTabSnapshots<T extends SessionTabSnapshot>(
  options: {
    readonly maxSnapshots?: number;
    readonly changed?: () => void;
    readonly released?: (
      tabId: string,
      reason: SnapshotRetentionReason,
    ) => void;
  } = {},
) {
  const maxSnapshots = Math.max(1, Math.floor(options.maxSnapshots ?? 12));
  const items = new Map<string, T>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const changed = options.changed ?? (() => undefined);
  const released = options.released ?? (() => undefined);

  const clearTimer = (tabId: string): void => {
    const timer = timers.get(tabId);
    if (timer) {
      clearTimeout(timer);
      decMemoryCounter('active-timers');
    }
    timers.delete(tabId);
  };
  const release = (
    tabId: string,
    reason: SnapshotRetentionReason = 'tab-removed',
  ): void => {
    clearTimer(tabId);
    if (!items.delete(tabId)) return;
    decMemoryCounter('closed-tab-snapshots');
    released(tabId, reason);
    changed();
  };
  const prune = (): void => {
    while (items.size > maxSnapshots) {
      const oldest = items.keys().next().value as string | undefined;
      if (!oldest) break;
      release(oldest, 'retention-replaced');
    }
  };

  return {
    records: (): T[] => [...items.values()],
    retain: (snapshot: T, seconds: number): void => {
      release(snapshot.id, 'retention-replaced');
      if (seconds <= 0) return;
      items.set(snapshot.id, snapshot);
      timers.set(
        snapshot.id,
        setTimeout(
          () => release(snapshot.id, 'retention-expired'),
          seconds * 1000,
        ),
      );
      incMemoryCounter('active-timers');
      incMemoryCounter('closed-tab-snapshots');
      prune();
      changed();
    },
    take: (tabId: string): T | undefined => {
      const snapshot = items.get(tabId);
      clearTimer(tabId);
      items.delete(tabId);
      if (snapshot) {
        decMemoryCounter('closed-tab-snapshots');
        changed();
      }
      return snapshot;
    },
    release,
    releaseAll: (
      reason: SnapshotRetentionReason = 'retention-disabled',
    ): void => {
      for (const tabId of [...items.keys()]) release(tabId, reason);
      setMemoryCounter('closed-tab-snapshots', 0);
      setMemoryCounter('active-timers', 0);
    },
    releaseMissing: (validIds: ReadonlySet<string>): void => {
      for (const tabId of [...items.keys()]) {
        if (!validIds.has(tabId)) release(tabId, 'tab-removed');
      }
    },
  };
}
