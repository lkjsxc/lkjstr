import {
  feedPageSize,
  oldestCreatedAt,
  threadWindowSize,
} from '../events/feed-window';
import { queryFeed } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import {
  sharedRelayPool,
  type PoolEvent,
  type RelayPool,
} from '../relays/relay-pool';
import {
  RelaySubscriptionManager,
  type RelaySubscriptionManager as SubscriptionManager,
} from '../relays/subscription-manager';
import type { RelaySnapshot } from '../relays/types';
import {
  loadCachedThread,
  mergeThreadItems,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';

// prettier-ignore
export type ThreadState = {
  readonly items: readonly ThreadItem[]; readonly loading: boolean; readonly error: string | null; readonly eoseRelays: number;
  readonly loadingOlder: boolean; readonly hasOlder: boolean; readonly oldestCreatedAt?: number; readonly newerPruned: boolean;
};

export class ThreadRuntime {
  #pool: RelayPool;
  #subscriptions: SubscriptionManager;
  #cached: ThreadItem[] = [];
  #live: ThreadItem[] = [];
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: ThreadState) => void>();
  #state: ThreadState = emptyState();
  #pageSize = feedPageSize;
  #startedAt = Math.floor(Date.now() / 1000);

  constructor(
    readonly eventId: string,
    readonly relays: readonly string[],
    readonly subId = `thread:${crypto.randomUUID()}`,
    pool?: RelayPool,
    subscriptions?: SubscriptionManager,
  ) {
    this.#pool = pool ?? sharedRelayPool;
    this.#subscriptions =
      subscriptions ?? new RelaySubscriptionManager(this.#pool);
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
      this.#subscriptions.subscribeState((snapshots) =>
        this.#receiveState(snapshots),
      ),
      this.#subscriptions.subscribeLive(
        {
          key: this.subId,
          relays: this.relays,
          filters: [
            { ids: [this.eventId] },
            {
              kinds: [1],
              '#e': [this.eventId],
              since: this.#startedAt,
              limit: this.#pageSize,
            },
          ],
        },
        (event) => this.#receive(event),
      ),
    );
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false, loadingOlder: false });
  }

  async loadOlder(): Promise<void> {
    if (this.#state.loadingOlder || !this.#state.hasOlder) return;
    const until = this.#state.oldestCreatedAt;
    if (!until) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const page = await queryFeed({
        kind: 'thread',
        eventId: this.eventId,
        until,
        limit: this.#pageSize,
      });
      const relayEvents =
        this.relays.length > 0
          ? await this.#subscriptions.readPage({
              key: `${this.subId}:older:${until}`,
              relays: this.relays,
              filters: [
                {
                  kinds: [1],
                  '#e': [this.eventId],
                  until,
                  limit: this.#pageSize,
                },
              ],
            })
          : [];
      await Promise.all(
        relayEvents.map((item) => storeThreadEvent(item.event, [item.relay])),
      );
      const items = mergeThreadItems(this.items(), [
        ...page.items,
        ...relayEvents.map((item) => ({
          event: item.event,
          relays: [item.relay],
        })),
      ]);
      const pruned = items.length > threadWindowSize;
      this.#cached = pruned ? items.slice(-threadWindowSize) : items;
      this.#live = [];
      this.#emit({
        ...this.#state,
        items: this.items(),
        hasOlder: page.hasMore || relayEvents.length >= this.#pageSize,
        newerPruned: this.#state.newerPruned || pruned,
      });
    } catch (error) {
      this.#emit({ ...this.#state, error: boundedErrorText(error) });
    } finally {
      if (this.#state.loadingOlder)
        this.#emit({ ...this.#state, loadingOlder: false });
    }
  }

  async resetToLatest(): Promise<void> {
    this.#cached = await loadCachedThread(this.eventId);
    this.#live = [];
    this.#emit({ ...this.#state, items: this.items(), newerPruned: false });
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId !== this.subId) return;
    await storeThreadEvent(poolEvent.event, [poolEvent.relay]);
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
    return mergeThreadItems(this.#cached, this.#live).slice(
      0,
      threadWindowSize,
    );
  }

  #emit(state: ThreadState): void {
    this.#state = {
      ...state,
      oldestCreatedAt: oldestCreatedAt(state.items),
    };
    this.#listeners.forEach((listener) => listener(this.#state));
  }
}

// prettier-ignore
function emptyState(): ThreadState {
  return { items: [], loading: true, error: null, eoseRelays: 0, loadingOlder: false, hasOlder: true, oldestCreatedAt: undefined, newerPruned: false };
}
