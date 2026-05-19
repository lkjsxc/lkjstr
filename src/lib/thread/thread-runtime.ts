import {
  feedPageSize,
  cursorPoint,
  oldestCreatedAt,
  threadWindowSize,
} from '../events/feed-window';
import { lookupEvent } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import { replyRoot } from '../protocol';
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
import {
  loadInitialThreadPage,
  loadOlderThreadPage,
} from './thread-runtime-pages';

// prettier-ignore
export type ThreadState = {
  readonly items: readonly ThreadItem[]; readonly loading: boolean; readonly error: string | null; readonly eoseRelays: number;
  readonly loadingOlder: boolean; readonly hasOlder: boolean; readonly oldestCreatedAt?: number; readonly oldestCursor?: FeedCursorPoint; readonly newerPruned: boolean;
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
  #rootId: string;

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
    this.#rootId = eventId;
  }

  subscribe(listener: (state: ThreadState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    await this.#discoverRoot();
    this.#cached = mergeThreadItems(
      await loadCachedThread(this.#rootId),
      this.#rootId === this.eventId ? [] : await loadCachedThread(this.eventId),
    );
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
            { ids: [this.#rootId] },
            {
              kinds: [1],
              '#e': [this.#rootId, this.eventId],
              since: this.#startedAt,
              limit: this.#pageSize,
            },
          ],
        },
        (event) => this.#receive(event),
      ),
    );
    void this.#loadInitialPage();
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false, loadingOlder: false });
  }

  // prettier-ignore
  async loadOlder(): Promise<void> {
    if (this.#state.loadingOlder || !this.#state.hasOlder) return; const cursor = this.#state.oldestCursor; if (!cursor) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const page = await loadOlderThreadPage({ eventId: this.eventId, rootId: this.#rootId, items: this.items(), relays: this.relays, subId: this.subId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      this.#cached = page.items; this.#live = [];
      this.#emit({ ...this.#state, items: this.items(), hasOlder: page.hasOlder, newerPruned: this.#state.newerPruned || page.pruned });
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingOlder) this.#emit({ ...this.#state, loadingOlder: false }); }
  }

  async #discoverRoot(): Promise<void> {
    const selected = await lookupEvent(this.eventId).catch(() => undefined);
    this.#rootId = selected
      ? (replyRoot(selected.event) ?? this.eventId)
      : this.eventId;
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId !== this.subId) return;
    await storeThreadEvent(poolEvent.event, [poolEvent.relay]);
    this.#live = mergeThreadItems(this.#live, [
      { event: poolEvent.event, relays: [poolEvent.relay] },
    ]);
    this.#emit({ ...this.#state, items: this.items(), loading: false });
  }

  async #loadInitialPage(): Promise<void> {
    try {
      const page = await loadInitialThreadPage({
        eventId: this.eventId,
        rootId: this.#rootId,
        relays: this.relays,
        subId: this.subId,
        pageSize: this.#pageSize,
        subscriptions: this.#subscriptions,
      });
      this.#rootId = page.rootId;
      this.#cached = mergeThreadItems(this.items(), page.items);
      this.#emit({ ...this.#state, items: this.items(), loading: false });
    } catch (error) {
      this.#emit({
        ...this.#state,
        loading: false,
        error: boundedErrorText(error),
      });
    }
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
      oldestCursor: cursorPoint(state.items.at(-1)),
    };
    this.#listeners.forEach((listener) => listener(this.#state));
  }
}

// prettier-ignore
function emptyState(): ThreadState {
  return { items: [], loading: true, error: null, eoseRelays: 0, loadingOlder: false, hasOlder: true, oldestCreatedAt: undefined, oldestCursor: undefined, newerPruned: false };
}
