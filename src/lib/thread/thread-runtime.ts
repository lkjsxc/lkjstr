import {
  sharedRelayPool,
  type PoolEvent,
  type RelayPool,
} from '../relays/relay-pool';
import type { RelaySnapshot } from '../relays/types';
import {
  loadCachedThread,
  mergeThreadItems,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';

export type ThreadState = {
  readonly items: readonly ThreadItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly eoseRelays: number;
};

export class ThreadRuntime {
  #pool: RelayPool;
  #cached: ThreadItem[] = [];
  #live: ThreadItem[] = [];
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: ThreadState) => void>();
  #state: ThreadState = emptyState();

  constructor(
    readonly eventId: string,
    readonly relays: readonly string[],
    readonly subId = `thread:${crypto.randomUUID()}`,
    pool?: RelayPool,
  ) {
    this.#pool = pool ?? sharedRelayPool;
  }

  subscribe(listener: (state: ThreadState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    this.#cached = await loadCachedThread(this.eventId);
    this.#emit({ ...this.#state, items: this.#cached });
    if (this.relays.length === 0)
      return this.#emit({
        ...this.#state,
        loading: false,
        error: 'No enabled read relays.',
      });
    this.#cleanup.push(
      this.#pool.onEvent((event) => this.#receive(event)),
      this.#pool.onState((snapshots) => this.#receiveState(snapshots)),
      this.#pool.subscribe(this.relays, this.subId, [
        { ids: [this.eventId] },
        { kinds: [1], '#e': [this.eventId], limit: 100 },
      ]),
    );
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false });
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId !== this.subId) return;
    await storeThreadEvent(poolEvent.event);
    this.#live = mergeThreadItems(this.#live, [
      { event: poolEvent.event, relays: [poolEvent.relay] },
    ]);
    this.#emit({ ...this.#state, items: this.items(), loading: false });
  }

  #receiveState(snapshots: RelaySnapshot[]): void {
    const active = snapshots.filter((item) => this.relays.includes(item.url));
    const eoseRelays = active.filter(
      (item) => item.eoseBySub[this.subId],
    ).length;
    this.#emit({
      ...this.#state,
      eoseRelays,
      loading:
        active.length > 0 && eoseRelays >= active.length
          ? false
          : this.#state.loading,
    });
  }

  items(): ThreadItem[] {
    return mergeThreadItems(this.#cached, this.#live);
  }

  #emit(state: ThreadState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
  }
}

function emptyState(): ThreadState {
  return { items: [], loading: true, error: null, eoseRelays: 0 };
}
