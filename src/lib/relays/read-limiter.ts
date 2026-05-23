import { normalizeRelayUrl } from '../protocol';
import type { RelaySnapshot } from './types';

export class PerRelayReadLimiter {
  #active = new Map<string, number>();
  #queues = new Map<string, (() => void)[]>();
  readonly #limit: number;

  constructor(limit: number) {
    this.#limit = Math.max(1, Math.floor(limit));
  }

  async acquire(relays: readonly string[]): Promise<() => void> {
    const acquired: string[] = [];
    for (const relay of relays) {
      await this.#acquireOne(relay);
      acquired.push(relay);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const relay of [...acquired].reverse()) this.#releaseOne(relay);
    };
  }

  #acquireOne(relay: string): Promise<void> {
    const active = this.#active.get(relay) ?? 0;
    if (active < this.#limit) {
      this.#active.set(relay, active + 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const queue = this.#queues.get(relay) ?? [];
      queue.push(() => {
        this.#active.set(relay, (this.#active.get(relay) ?? 0) + 1);
        resolve();
      });
      this.#queues.set(relay, queue);
    });
  }

  #releaseOne(relay: string): void {
    const active = (this.#active.get(relay) ?? 0) - 1;
    if (active > 0) this.#active.set(relay, active);
    else this.#active.delete(relay);
    const queue = this.#queues.get(relay);
    const next = queue?.shift();
    if (!queue || queue.length === 0) this.#queues.delete(relay);
    next?.();
  }
}

export function limitedReadRelays(relays: readonly string[]): string[] {
  return [
    ...new Set(
      relays
        .map(normalizeRelayUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ].sort();
}

export function readPageComplete(
  snapshots: readonly RelaySnapshot[],
  relays: readonly string[],
  subId: string,
): boolean {
  const relaySet = new Set(limitedReadRelays(relays));
  const active = snapshots.filter((item) => {
    const url = normalizeRelayUrl(item.url);
    return url ? relaySet.has(url) : false;
  });
  return (
    active.length > 0 &&
    active.every(
      (item) =>
        item.eoseBySub[subId] ||
        item.closedBySub[subId] ||
        item.state === 'closed' ||
        item.state === 'error',
    )
  );
}
