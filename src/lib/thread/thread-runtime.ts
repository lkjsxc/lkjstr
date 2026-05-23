import { feedPageSize, threadWindowSize } from '../events/feed-window';
import { lookupEvent } from '../events/repository';
import { afterCursor } from '../events/repository-shared';
import { boundedErrorText } from '../events/runtime-error';
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
import { threadRelayState } from './thread-relay-state';
import {
  loadCachedThread,
  mergeThreadItems,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';
import {
  loadInitialThreadPage,
  loadNewerThreadPage,
  loadOlderThreadPage,
} from './thread-runtime-pages';
import {
  isThreadReactionKind,
  isThreadRepostKind,
  threadLiveFilters,
} from './thread-subscription-filters';
import {
  cachedThreadReactions,
  cachedThreadReposts,
  mergeReactionEvent,
  mergeRepostEvent,
  storeReaction,
  storeThreadActivity,
} from './thread-reactions';
import {
  emptyThreadState,
  withThreadCursors,
  type ThreadState,
} from './thread-state';
export class ThreadRuntime {
  #subscriptions: SubscriptionManager;
  #cached: ThreadItem[] = [];
  #live: ThreadItem[] = [];
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: ThreadState) => void>();
  #state: ThreadState = emptyThreadState();
  #pageSize = feedPageSize;
  #startedAt = Math.floor(Date.now() / 1000);
  #rootId: string;
  #closed = false;
  #generation = 0;
  constructor(
    readonly eventId: string,
    readonly relays: readonly string[],
    readonly subId = `thread:${crypto.randomUUID()}`,
    pool?: RelayPool,
    subscriptions?: SubscriptionManager,
  ) {
    const relayPool = pool ?? sharedRelayPool;
    this.#subscriptions =
      subscriptions ?? new RelaySubscriptionManager(relayPool);
    this.#rootId = eventId;
  }
  // prettier-ignore
  subscribe(listener: (state: ThreadState) => void): () => void { this.#listeners.add(listener); listener(this.#state); return () => this.#listeners.delete(listener); }

  async start(): Promise<void> {
    if (this.#closed) return;
    const generation = ++this.#generation;
    await this.#discoverRoot();
    if (!this.#active(generation)) return;
    this.#cached = mergeThreadItems(
      await loadCachedThread(this.#rootId),
      this.#rootId === this.eventId ? [] : await loadCachedThread(this.eventId),
    );
    if (!this.#active(generation)) return;
    this.#emit({ ...this.#state, items: this.#cached });
    // prettier-ignore
    if (this.relays.length === 0) return this.#emit({ ...this.#state, loading: false, error: 'No enabled read relays.' });
    this.#cleanup.push(
      this.#subscriptions.subscribeState((snapshots) =>
        this.#receiveState(snapshots),
      ),
      this.#subscriptions.subscribeLive(
        {
          key: this.subId,
          relays: this.relays,
          filters: threadLiveFilters(
            this.eventId,
            this.#rootId,
            this.#startedAt,
            this.#pageSize,
          ),
        },
        (event) => this.#receive(event),
      ),
    );
    void this.#loadInitialPage();
  }

  // prettier-ignore
  close(): void { this.#closed = true; this.#generation++; for (const cleanup of this.#cleanup.splice(0)) cleanup(); this.#listeners.clear(); }

  // prettier-ignore
  async loadOlder(): Promise<void> {
    if (this.#closed || this.#state.loadingOlder || !this.#state.hasOlder) return; const generation = this.#generation; const cursor = this.#state.oldestCursor; if (!cursor) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const page = await loadOlderThreadPage({ eventId: this.eventId, rootId: this.#rootId, items: this.items(), relays: this.relays, subId: this.subId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return;
      this.#cached = page.items; this.#live = [];
      this.#emit({ ...this.#state, items: this.items(), hasOlder: page.hasOlder, hasNewer: this.#state.hasNewer || page.pruned, newerPruned: this.#state.newerPruned || page.pruned });
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingOlder) this.#emit({ ...this.#state, loadingOlder: false }); }
  }

  // prettier-ignore
  async loadNewer(): Promise<void> {
    if (this.#closed || this.#state.loadingNewer || !this.#state.hasNewer) return; const generation = this.#generation; const cursor = this.#state.newestCursor; if (!cursor) return;
    this.#emit({ ...this.#state, loadingNewer: true });
    try {
      const page = await loadNewerThreadPage({ eventId: this.eventId, rootId: this.#rootId, items: this.items(), relays: this.relays, subId: this.subId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return; this.#cached = page.items; this.#live = []; this.#emit({ ...this.#state, items: this.items(), hasNewer: page.hasNewer, hasOlder: this.#state.hasOlder || page.pruned, newerPruned: page.hasNewer });
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingNewer) this.#emit({ ...this.#state, loadingNewer: false }); }
  }

  async #discoverRoot(): Promise<void> {
    const selected = await lookupEvent(this.eventId).catch(() => undefined);
    this.#rootId = selected
      ? (replyRoot(selected.event) ?? this.eventId)
      : this.eventId;
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (this.#closed) return;
    if (poolEvent.subId !== this.subId) return;
    if (isThreadReactionKind(poolEvent.event.kind))
      return this.#receiveReaction(poolEvent);
    // prettier-ignore
    if (isThreadRepostKind(poolEvent.event.kind)) { await storeThreadActivity(poolEvent.event, poolEvent.relay); if (!this.#closed) this.#emit({ ...this.#state, reposts: mergeRepostEvent(this.#state.reposts, poolEvent.event) }); return; }
    await storeThreadEvent(poolEvent.event, [poolEvent.relay]);
    if (this.#closed) return;
    // prettier-ignore
    if (this.#state.newerPruned && afterCursor(poolEvent.event, this.#state.newestCursor)) { this.#emit({ ...this.#state, loading: false, hasNewer: true }); return; }
    this.#live = mergeThreadItems(this.#live, [
      { event: poolEvent.event, relays: [poolEvent.relay] },
    ]);
    this.#emit({ ...this.#state, items: this.items(), loading: false });
  }

  // prettier-ignore
  async #loadInitialPage(): Promise<void> {
    const generation = this.#generation;
    try {
      const page = await loadInitialThreadPage({ eventId: this.eventId, rootId: this.#rootId, relays: this.relays, subId: this.subId, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return; this.#rootId = page.rootId; this.#cached = mergeThreadItems(this.items(), page.items);
      const ids = this.items().map((item) => item.event.id);
      const [reactions, reposts] = await Promise.all([cachedThreadReactions(ids), cachedThreadReposts(ids)]);
      if (!this.#active(generation)) return;
      this.#emit({ ...this.#state, items: this.items(), loading: false, reactions, reposts });
    } catch (error) { this.#emit({ ...this.#state, loading: false, error: boundedErrorText(error) }); }
  }

  // prettier-ignore
  async #receiveReaction(poolEvent: PoolEvent): Promise<void> {
    await storeReaction(poolEvent.event, poolEvent.relay); if (this.#closed) return;
    this.#emit({ ...this.#state, reactions: mergeReactionEvent(this.#state.reactions, poolEvent.event) });
  }

  // prettier-ignore
  #receiveState(snapshots: RelaySnapshot[]): void {
    if (this.#closed) return; const state = threadRelayState(snapshots, this.relays, this.subId);
    this.#emit({ ...this.#state, eoseRelays: state.eoseRelays, loading: state.activeRelays > 0 && state.terminalRelays >= state.activeRelays ? false : this.#state.loading });
  }

  // prettier-ignore
  items(): ThreadItem[] { return mergeThreadItems(this.#cached, this.#live).slice(0, threadWindowSize); }

  #emit(state: ThreadState): void {
    if (this.#closed) return;
    this.#state = withThreadCursors(state);
    this.#listeners.forEach((listener) => listener(this.#state));
  }

  // prettier-ignore
  #active(generation: number): boolean { return !this.#closed && generation === this.#generation; }
}
