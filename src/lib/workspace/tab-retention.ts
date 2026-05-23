export type RetainedTab = {
  readonly id: string;
};

export type RetentionCloseReason =
  | 'retention-expired'
  | 'retention-replaced'
  | 'retention-disabled'
  | 'tab-removed'
  | 'pane-destroyed';

export class TabRetention<T extends RetainedTab> {
  #items = new Map<string, T>();
  #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    readonly changed: () => void = () => {},
    readonly closed: (
      tabId: string,
      reason: RetentionCloseReason,
    ) => void = () => {},
  ) {}

  records(): T[] {
    return [...this.#items.values()];
  }

  retain(item: T, seconds: number): void {
    this.release(item.id, 'retention-replaced');
    if (seconds <= 0) return;
    this.#items.set(item.id, item);
    this.#timers.set(
      item.id,
      setTimeout(
        () => this.release(item.id, 'retention-expired'),
        seconds * 1000,
      ),
    );
    this.changed();
  }

  release(tabId: string, reason: RetentionCloseReason = 'tab-removed'): void {
    const timer = this.#timers.get(tabId);
    if (timer) clearTimeout(timer);
    this.#timers.delete(tabId);
    if (!this.#items.delete(tabId)) return;
    this.closed(tabId, reason);
    this.changed();
  }

  keep(tabId: string): void {
    const timer = this.#timers.get(tabId);
    if (timer) clearTimeout(timer);
    this.#timers.delete(tabId);
  }

  releaseAll(reason: RetentionCloseReason = 'retention-disabled'): void {
    for (const tabId of [...this.#items.keys()]) this.release(tabId, reason);
  }

  releaseMissing(validIds: ReadonlySet<string>): void {
    for (const tabId of [...this.#items.keys()]) {
      if (!validIds.has(tabId)) this.release(tabId, 'tab-removed');
    }
  }
}
