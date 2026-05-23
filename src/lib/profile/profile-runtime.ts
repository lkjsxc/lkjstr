import {
  feedPageSize,
  feedWindowSize,
  cursorPoint,
  mergeFeedWindow,
  oldestCreatedAt,
} from '$lib/events/feed-window';
import { afterCursor } from '$lib/events/repository-shared';
import { boundedErrorText } from '$lib/events/runtime-error';
import { isFeedDisplayKind } from '$lib/events/feed-kinds';
import {
  getProfile,
  profileFromMetadataEvent,
} from '$lib/identity/profile-cache';
import type { NostrEvent } from '$lib/protocol';
import type { PoolEvent, RelayPool } from '$lib/relays/relay-pool';
import { runtimeSubscriptions } from '$lib/relays/runtime-subscriptions';
import { type RelaySubscriptionManager as SubscriptionManager } from '$lib/relays/subscription-manager';
import {
  cachedProfileEvent,
  cachedProfileFollowList,
  cachedProfileNotes,
  storeProfileEvent,
} from './profile-store';
import { loadInitialProfilePage } from './profile-runtime-initial';
import {
  loadNewerProfilePage,
  loadOlderProfilePage,
} from './profile-runtime-paging';
import { emptyProfileState, type ProfileState } from './profile-state';
import { profileLiveFilters } from './profile-subscription-filters';

export type { ProfileState } from './profile-state';

export class ProfileRuntime {
  #subscriptions: SubscriptionManager;
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: ProfileState) => void>();
  #state: ProfileState = emptyProfileState();
  #pageSize = feedPageSize;
  #startedAt = Math.floor(Date.now() / 1000);
  #closed = false;
  #generation = 0;

  constructor(
    readonly pubkey: string,
    readonly relays: readonly string[],
    readonly subId = `profile:${crypto.randomUUID()}`,
    pool?: RelayPool,
    subscriptions?: SubscriptionManager,
  ) {
    this.#subscriptions = runtimeSubscriptions(pool, subscriptions);
  }

  subscribe(listener: (state: ProfileState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.#closed) return;
    const generation = ++this.#generation;
    const [meta, posts, followList] = await Promise.all([
      cachedProfileEvent(this.pubkey),
      cachedProfileNotes(this.pubkey, this.#pageSize),
      cachedProfileFollowList(this.pubkey),
    ]);
    if (!this.#active(generation)) return;
    const profile =
      getProfile(this.pubkey) ?? (meta ? profileFromMetadataEvent(meta) : null);
    this.#emit({
      ...this.#state,
      profile,
      posts,
      followList,
      loading: this.relays.length > 0,
      updatedAt: meta ? meta.created_at * 1000 : null,
      oldestCreatedAt: oldestCreatedAt(posts),
    });
    if (this.relays.length === 0) return;
    this.#cleanup.push(
      this.#subscriptions.subscribeLive(
        {
          key: this.subId,
          relays: this.relays,
          filters: profileLiveFilters(
            this.pubkey,
            this.#startedAt,
            this.#pageSize,
          ),
          purpose: 'feed',
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
      const page = await loadOlderProfilePage({ posts: this.#state.posts, pubkey: this.pubkey, relays: this.relays, subId: this.subId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return; this.#emit({ ...this.#state, posts: page.posts, hasOlder: page.hasOlder, hasNewer: this.#state.hasNewer || page.newerPruned, newerPruned: this.#state.newerPruned || page.newerPruned });
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingOlder) this.#emit({ ...this.#state, loadingOlder: false }); }
  }

  // prettier-ignore
  async loadNewer(): Promise<void> {
    if (this.#closed || this.#state.loadingNewer || !this.#state.hasNewer) return; const generation = this.#generation; const cursor = this.#state.newestCursor; if (!cursor) return;
    this.#emit({ ...this.#state, loadingNewer: true });
    try {
      const page = await loadNewerProfilePage({ posts: this.#state.posts, pubkey: this.pubkey, relays: this.relays, subId: this.subId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return; this.#emit({ ...this.#state, posts: page.posts, hasNewer: page.hasNewer, hasOlder: this.#state.hasOlder || page.olderPruned, newerPruned: page.hasNewer });
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingNewer) this.#emit({ ...this.#state, loadingNewer: false }); }
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (this.#closed) return;
    if (poolEvent.subId !== this.subId) return;
    if (poolEvent.event.pubkey !== this.pubkey) return;
    await storeProfileEvent(poolEvent.event, [poolEvent.relay]);
    if (this.#closed) return;
    if (poolEvent.event.kind === 0) this.#receiveMeta(poolEvent);
    if (poolEvent.event.kind === 3) this.#receiveFollowList(poolEvent.event);
    if (isFeedDisplayKind(poolEvent.event.kind))
      this.#receivePost(poolEvent.event, poolEvent.relay);
  }

  #receiveFollowList(event: NostrEvent): void {
    const current = this.#state.followList;
    if (current && current.created_at > event.created_at) return;
    if (current?.id === event.id) return;
    this.#emit({ ...this.#state, followList: event, loading: false });
  }

  #receiveMeta(poolEvent: PoolEvent): void {
    if (poolEvent.event.pubkey !== this.pubkey) return;
    const updatedAt = poolEvent.event.created_at * 1000;
    if (this.#state.updatedAt && this.#state.updatedAt > updatedAt) return;
    const profile =
      getProfile(this.pubkey) ?? profileFromMetadataEvent(poolEvent.event);
    if (profile.updatedAt > updatedAt) return;
    this.#emit({
      ...this.#state,
      profile,
      loading: false,
      relays: [...new Set([...this.#state.relays, poolEvent.relay])],
      updatedAt: profile.updatedAt,
    });
  }

  // prettier-ignore
  #receivePost(event: NostrEvent, relay: string): void {
    if (this.#closed) return; const item = { event, relays: [relay] }; if (this.#state.newerPruned && afterCursor(event, this.#state.newestCursor)) { this.#emit({ ...this.#state, loading: false, hasNewer: true }); return; }
    const window = mergeFeedWindow(this.#state.posts, [item], feedWindowSize); this.#emit(this.#withCursors({ ...this.#state, posts: window.items, loading: false, hasOlder: this.#state.hasOlder || window.prunedOlder }));
  }

  // prettier-ignore
  async #loadInitialPage(): Promise<void> {
    const generation = this.#generation;
    try {
      const page = await loadInitialProfilePage({ posts: this.#state.posts, profile: this.#state.profile, followList: this.#state.followList, relays: this.relays, pubkey: this.pubkey, subId: this.subId, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return; this.#emit({ ...this.#state, profile: page.profile, followList: page.followList, posts: page.posts, loading: false, relays: [...new Set([...this.#state.relays, ...page.relays])] });
    } catch (error) { this.#emit({ ...this.#state, loading: false, error: boundedErrorText(error) }); }
  }

  #emit(state: ProfileState): void {
    if (this.#closed) return;
    this.#state = this.#withCursors(state);
    this.#listeners.forEach((listener) => listener(this.#state));
  }

  // prettier-ignore
  #active(generation: number): boolean { return !this.#closed && generation === this.#generation; }

  #withCursors(state: ProfileState): ProfileState {
    return {
      ...state,
      newestCursor: cursorPoint(state.posts.at(0)),
      oldestCreatedAt: oldestCreatedAt(state.posts),
      oldestCursor: cursorPoint(state.posts.at(-1)),
    };
  }
}
