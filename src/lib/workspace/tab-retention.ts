export type RetainedTab = {
  readonly id: string;
};

export class TabRetention<T extends RetainedTab> {
  #items = new Map<string, T>();
  #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(readonly changed: () => void = () => {}) {}

  records(): T[] {
    return [...this.#items.values()];
  }

  retain(item: T, seconds: number): void {
    this.release(item.id);
    if (seconds <= 0) return;
    this.#items.set(item.id, item);
    this.#timers.set(
      item.id,
      setTimeout(() => this.release(item.id), seconds * 1000),
    );
    this.changed();
  }

  release(tabId: string): void {
    const timer = this.#timers.get(tabId);
    if (timer) clearTimeout(timer);
    this.#timers.delete(tabId);
    if (!this.#items.delete(tabId)) return;
    this.changed();
  }

  keep(tabId: string): void {
    const timer = this.#timers.get(tabId);
    if (timer) clearTimeout(timer);
    this.#timers.delete(tabId);
  }

  releaseAll(): void {
    for (const tabId of [...this.#items.keys()]) this.release(tabId);
  }

  releaseMissing(validIds: ReadonlySet<string>): void {
    for (const tabId of [...this.#items.keys()]) {
      if (!validIds.has(tabId)) this.release(tabId);
    }
  }
}
