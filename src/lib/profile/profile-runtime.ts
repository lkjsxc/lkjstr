import type { ProfileSummary } from '$lib/identity/identity';
import {
  feedPageSize,
  feedWindowSize,
  oldestCreatedAt,
} from '$lib/events/feed-window';
import { boundedErrorText } from '$lib/events/runtime-error';
import { profileFromMetadataEvent } from '$lib/identity/profile-cache';
import type { NostrEvent } from '$lib/protocol';
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
import { loadOlderProfilePage } from './profile-runtime-paging';

// prettier-ignore
export type ProfileState = {
  readonly profile: ProfileSummary | null; readonly posts: readonly NostrEvent[];
  readonly loading: boolean; readonly error: string | null; readonly relays: readonly string[];
  readonly updatedAt: number | null; readonly loadingOlder: boolean; readonly hasOlder: boolean;
  readonly oldestCreatedAt?: number; readonly newerPruned: boolean;
};

export class ProfileRuntime {
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
    const relayPool = pool ?? sharedRelayPool;
    this.#subscriptions =
      subscriptions ?? new RelaySubscriptionManager(relayPool);
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
    try {
      const page = await loadOlderProfilePage({
        posts: this.#state.posts,
        pubkey: this.pubkey,
        relays: this.relays,
        subId: this.subId,
        until,
        pageSize: this.#pageSize,
        subscriptions: this.#subscriptions,
      });
      this.#emit({
        ...this.#state,
        posts: page.posts,
        hasOlder: page.hasOlder,
        newerPruned: this.#state.newerPruned || page.newerPruned,
      });
    } catch (error) {
      this.#emit({ ...this.#state, error: boundedErrorText(error) });
    } finally {
      if (this.#state.loadingOlder)
        this.#emit({ ...this.#state, loadingOlder: false });
    }
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
