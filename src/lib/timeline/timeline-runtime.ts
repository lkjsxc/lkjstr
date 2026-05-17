import type { NostrEvent, NostrFilter } from '../protocol';
import { RelayPool, type PoolEvent } from '../relays/relay-pool';
import type { RelaySnapshot } from '../relays/types';
import {
  loadCachedTimeline,
  mergeTimelineItems,
  storeTimelineEvent,
  type TimelineItem,
} from './timeline-store';

const sharedPool = new RelayPool();

export type TimelineState = {
  readonly items: readonly TimelineItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly connectedRelays: number;
  readonly eoseRelays: number;
};

export type TimelineRuntimeOptions = {
  readonly relays: readonly string[];
  readonly subId: string;
  readonly limit?: number;
  readonly pool?: RelayPool;
};

export class TimelineRuntime {
  #pool: RelayPool;
  #cached: TimelineItem[] = [];
  #live: TimelineItem[] = [];
  #state: TimelineState = emptyState();
  #listeners = new Set<(state: TimelineState) => void>();
  #cleanup: (() => void)[] = [];
  #filters: readonly NostrFilter[];

  constructor(readonly options: TimelineRuntimeOptions) {
    this.#pool = options.pool ?? sharedPool;
    this.#filters = [{ kinds: [1], limit: this.limit }];
  }

  get limit(): number {
    return this.options.limit ?? 50;
  }

  subscribe(listener: (state: TimelineState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    this.#cached = await loadCachedTimeline(this.limit);
    this.#emit({ ...this.#state, items: this.#cached, loading: true });
    if (this.options.relays.length === 0) {
      this.#emit({
        ...this.#state,
        loading: false,
        error: 'No relays configured.',
      });
      return;
    }
    this.#cleanup.push(
      this.#pool.onEvent((event) => this.#receive(event)),
      this.#pool.onState((snapshots) => this.#receiveState(snapshots)),
      this.#pool.subscribe(
        this.options.relays,
        this.options.subId,
        this.#filters,
      ),
    );
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false });
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId !== this.options.subId || poolEvent.event.kind !== 1)
      return;
    await storeTimelineEvent(poolEvent.event);
    this.#live = upsertLive(this.#live, poolEvent.event, poolEvent.relay);
    this.#emit({
      ...this.#state,
      items: this.items(),
      loading: false,
      error: null,
    });
  }

  #receiveState(snapshots: RelaySnapshot[]): void {
    const active = snapshots.filter((item) =>
      this.options.relays.includes(item.url),
    );
    const connectedRelays = active.filter(
      (item) => item.state === 'open',
    ).length;
    const eoseRelays = active.filter(
      (item) => item.eoseBySub[this.options.subId],
    ).length;
    const failed =
      active.length > 0 && active.every((item) => item.state === 'error');
    this.#emit({
      ...this.#state,
      connectedRelays,
      eoseRelays,
      error: failed ? 'No relay is reachable.' : this.#state.error,
    });
  }

  private items(): TimelineItem[] {
    return mergeTimelineItems(this.#cached, this.#live, this.limit);
  }

  #emit(state: TimelineState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
  }
}

function upsertLive(
  items: readonly TimelineItem[],
  event: NostrEvent,
  relay: string,
): TimelineItem[] {
  const existing = items.find((item) => item.event.id === event.id);
  if (!existing) return [...items, { event, relays: [relay] }];
  return items.map((item) =>
    item.event.id === event.id
      ? { event, relays: [...new Set([...item.relays, relay])] }
      : item,
  );
}

function emptyState(): TimelineState {
  return {
    items: [],
    loading: true,
    error: null,
    connectedRelays: 0,
    eoseRelays: 0,
  };
}
