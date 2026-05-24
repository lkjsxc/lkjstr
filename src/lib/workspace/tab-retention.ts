export type RetainedTab = {
  readonly id: string;
};

export type RetentionCloseReason =
  | 'retention-expired'
  | 'retention-replaced'
  | 'retention-disabled'
  | 'tab-removed'
  | 'pane-destroyed';

export type TabRetention<T extends RetainedTab> = ReturnType<
  typeof createTabRetention<T>
>;

export function createTabRetention<T extends RetainedTab>(
  changed: () => void = () => {},
  closed: (tabId: string, reason: RetentionCloseReason) => void = () => {},
) {
  const items = new Map<string, T>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const release = (
    tabId: string,
    reason: RetentionCloseReason = 'tab-removed',
  ): void => {
    const timer = timers.get(tabId);
    if (timer) clearTimeout(timer);
    timers.delete(tabId);
    if (!items.delete(tabId)) return;
    closed(tabId, reason);
    changed();
  };

  return {
    records: (): T[] => [...items.values()],
    retain: (item: T, seconds: number): void => {
      release(item.id, 'retention-replaced');
      if (seconds <= 0) return;
      items.set(item.id, item);
      timers.set(
        item.id,
        setTimeout(() => release(item.id, 'retention-expired'), seconds * 1000),
      );
      changed();
    },
    release,
    keep: (tabId: string): void => {
      const timer = timers.get(tabId);
      if (timer) clearTimeout(timer);
      timers.delete(tabId);
    },
    releaseAll: (reason: RetentionCloseReason = 'retention-disabled'): void => {
      for (const tabId of [...items.keys()]) release(tabId, reason);
    },
    releaseMissing: (validIds: ReadonlySet<string>): void => {
      for (const tabId of [...items.keys()]) {
        if (!validIds.has(tabId)) release(tabId, 'tab-removed');
      }
    },
  };
}
