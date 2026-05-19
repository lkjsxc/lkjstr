import type { ProfileSummary } from '$lib/identity/identity';
import {
  feedPageSize,
  feedWindowSize,
  oldestCreatedAt,
} from '$lib/events/feed-window';
import { queryFeed } from '$lib/events/repository';
import { profileFromMetadataEvent } from '$lib/identity/profile-cache';
import { compareEventsDesc, type NostrEvent } from '$lib/protocol';
import {
  sharedRelayPool,
  type PoolEvent,
  type RelayPool,
} from '$lib/relays/relay-pool';
import {
  RelaySubscriptionManager,
  type RelaySubscriptionManager as SubscriptionManager,
} from '$lib/relays/subscription-manager';
import {
  cachedProfileEvent,
  cachedProfileNotes,
  storeProfileEvent,
} from './profile-store';

// prettier-ignore
export type ProfileState = {
  readonly profile: ProfileSummary | null; readonly posts: readonly NostrEvent[];
  readonly loading: boolean; readonly error: string | null; readonly relays: readonly string[];
  readonly updatedAt: number | null; readonly loadingOlder: boolean; readonly hasOlder: boolean;
  readonly oldestCreatedAt?: number; readonly newerPruned: boolean;
};

export class ProfileRuntime {
  #pool: RelayPool;
  #subscriptions: SubscriptionManager;
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: ProfileState) => void>();
  #state: ProfileState = emptyState();
  #pageSize = feedPageSize;
  #startedAt = Math.floor(Date.now() / 1000);

  constructor(
    readonly pubkey: string,
    readonly relays: readonly string[],
    readonly subId = `profile:${crypto.randomUUID()}`,
    pool?: RelayPool,
    subscriptions?: SubscriptionManager,
  ) {
    this.#pool = pool ?? sharedRelayPool;
    this.#subscriptions =
      subscriptions ?? new RelaySubscriptionManager(this.#pool);
  }

  subscribe(listener: (state: ProfileState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    const [meta, posts] = await Promise.all([
      cachedProfileEvent(this.pubkey),
      cachedProfileNotes(this.pubkey, this.#pageSize),
    ]);
    this.#emit({
      ...this.#state,
      profile: meta ? profileFromMetadataEvent(meta) : null,
      posts,
      loading: this.relays.length > 0,
      updatedAt: meta ? meta.created_at * 1000 : null,
      oldestCreatedAt: oldestCreatedAt(posts.map((event) => ({ event }))),
    });
    if (this.relays.length === 0) return;
    this.#cleanup.push(
      this.#subscriptions.subscribeLive(
        {
          key: this.subId,
          relays: this.relays,
          filters: [
            { kinds: [0], authors: [this.pubkey], limit: 1 },
            {
              kinds: [1],
              authors: [this.pubkey],
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
    const page = await queryFeed({
      kind: 'profile',
      authors: [this.pubkey],
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
                authors: [this.pubkey],
                until,
                limit: this.#pageSize,
              },
            ],
          })
        : [];
    await Promise.all(
      relayEvents.map((item) => storeProfileEvent(item.event, [item.relay])),
    );
    const posts = mergePosts(this.#state.posts, [
      ...page.items.map((item) => item.event),
      ...relayEvents.map((item) => item.event),
    ]);
    const pruned = posts.length > feedWindowSize;
    this.#emit({
      ...this.#state,
      posts: pruned ? posts.slice(-feedWindowSize) : posts,
      loadingOlder: false,
      hasOlder: page.hasMore || relayEvents.length >= this.#pageSize,
      newerPruned: this.#state.newerPruned || pruned,
    });
  }

  async resetToLatest(): Promise<void> {
    const posts = await cachedProfileNotes(this.pubkey, this.#pageSize);
    this.#emit({ ...this.#state, posts, newerPruned: false });
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId !== this.subId) return;
    await storeProfileEvent(poolEvent.event, [poolEvent.relay]);
    if (poolEvent.event.kind === 0) this.#receiveMeta(poolEvent);
    if (poolEvent.event.kind === 1) this.#receivePost(poolEvent.event);
  }

  #receiveMeta(poolEvent: PoolEvent): void {
    this.#emit({
      ...this.#state,
      profile: profileFromMetadataEvent(poolEvent.event),
      loading: false,
      relays: [...new Set([...this.#state.relays, poolEvent.relay])],
      updatedAt: poolEvent.event.created_at * 1000,
    });
  }

  #receivePost(event: NostrEvent): void {
    const posts = [
      event,
      ...this.#state.posts.filter((item) => item.id !== event.id),
    ]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, feedWindowSize);
    this.#emit(this.#withOldest({ ...this.#state, posts, loading: false }));
  }

  #emit(state: ProfileState): void {
    this.#state = this.#withOldest(state);
    this.#listeners.forEach((listener) => listener(this.#state));
  }

  #withOldest(state: ProfileState): ProfileState {
    return {
      ...state,
      oldestCreatedAt: oldestCreatedAt(state.posts.map((event) => ({ event }))),
    };
  }
}

// prettier-ignore
function emptyState(): ProfileState {
  return { profile: null, posts: [], loading: true, error: null, relays: [], updatedAt: null, loadingOlder: false, hasOlder: true, oldestCreatedAt: undefined, newerPruned: false };
}

// prettier-ignore
function mergePosts(current: readonly NostrEvent[], incoming: readonly NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  [...current, ...incoming].forEach((event) => byId.set(event.id, event));
  return [...byId.values()].sort(compareEventsDesc);
}
