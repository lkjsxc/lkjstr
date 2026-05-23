import { normalizeRelayUrl, type NostrFilter } from '../protocol';
import {
  boundaryCursors,
  feedPageSize,
  feedWindowSize,
  metadataPageLimit,
} from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';
import { isFeedDisplayKind } from '../events/feed-kinds';
import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import type { PoolEvent } from '../relays/relay-pool';
import { discoverAuthorRelayRoutes } from '../relays/relay-discovery';
import { runtimeSubscriptions } from '../relays/runtime-subscriptions';
import { routedAuthorRelays } from '../relays/relay-routing';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import { childRelaySubscriptionId } from '../relays/subscription-id';
import type { RelaySnapshot } from '../relays/types';
import { accountHomeAuthors, authorFilters } from './follow-list';
import { loadAccountHome, loadCachedAccountHome } from './timeline-load';
import type { TimelineLoad } from './timeline-load';
import {
  loadInitialTimelinePage,
  loadOlderTimelinePage,
} from './timeline-runtime-paging';
import { profileFilter, storeTimelineProfile } from './timeline-profiles';
import {
  needsSelfFallback,
  relayStatePatch,
  selectedRelaySnapshots,
} from './timeline-relay-state';
import {
  emptyState,
  noActiveAccountState,
  noEnabledRelayState,
  noFollowListState,
  readyWithEventsState,
  upsertLive,
  type TimelineRuntimeOptions,
  type TimelineState,
} from './timeline-state';
import { loadCachedTimeline, mergeTimelineItems } from './timeline-store';
import type { TimelineItem } from './timeline-store';
import { TimelineProfileCoordinator } from './timeline-profile-coordinator';
import { startTimelineBackfill } from './timeline-backfill';

// prettier-ignore
export class TimelineRuntime {
  #subscriptions: RelaySubscriptionManager; #cached: TimelineItem[] = []; #live: TimelineItem[] = [];
  #state: TimelineState = emptyState(); #listeners = new Set<(state: TimelineState) => void>(); #cleanup: (() => void)[] = [];
  #relays: string[]; #routeRelays: string[] = []; #pageSize: number; #authors: string[] = []; #profiles: TimelineState['profiles'] = {};
  #olderScanCursor?: FeedCursorPoint; #routeRefreshGeneration = 0;
  #followList?: TimelineLoad['followList']; #followListId = ''; #followFallbackStarted = false; #initialNotesKey = ''; #followSubId: string; #metaSubId: string; #noteSubId: string;
  #backfillStarted = false;
  #profileCoordinator: TimelineProfileCoordinator;
  #startedAt = Math.floor(Date.now() / 1000); #closed = false; #generation = 0;
  constructor(readonly options: TimelineRuntimeOptions) {
    this.#subscriptions = runtimeSubscriptions(options.pool, options.subscriptions);
    this.#followSubId = childRelaySubscriptionId(options.subId, 'follows'); this.#metaSubId = childRelaySubscriptionId(options.subId, 'meta'); this.#noteSubId = childRelaySubscriptionId(options.subId, 'notes');
    this.#pageSize = options.limit ?? feedPageSize; this.#relays = options.relays.map(normalizeRelayUrl).filter((url): url is string => Boolean(url));
    this.#profileCoordinator = new TimelineProfileCoordinator(this.#relays, this.#metaSubId);
  }
  subscribe(listener: (state: TimelineState) => void): () => void { this.#listeners.add(listener); listener(this.#state); return () => this.#listeners.delete(listener); }
  async start(): Promise<void> {
    if (this.#closed) return; const generation = ++this.#generation;
    const pubkey = this.options.activeAccountPubkey; if (!pubkey) return this.#startWithoutAccount();
    const loaded = await loadCachedAccountHome(pubkey, this.#pageSize).catch(() => ({ authors: [pubkey], cached: [], profiles: {} }));
    if (!this.#active(generation)) return;
    this.#applyLoaded(loaded); const state = this.#cached.length > 0 ? readyWithEventsState(this.#state, this.#cached) : { ...this.#state, items: this.#cached };
    this.#emit(this.#withCursors(state)); if (this.#relays.length === 0) return this.#emit(noEnabledRelayState(this.#state));
    this.#cleanup.push(this.#subscriptions.subscribeState((snapshots) => this.#receiveState(snapshots)));
    if (this.#followList) await this.#subscribeNotes(); else this.#subscribeFollows(pubkey);
  }
  close(): void { this.#closed = true; this.#generation++; for (const cleanup of this.#cleanup.splice(0)) cleanup(); this.#listeners.clear(); }
  async loadOlder(): Promise<void> {
    if (this.#closed || this.#state.loadingOlder || !this.#state.hasOlder) return; const generation = this.#generation; const cursor = this.#olderScanCursor ?? this.#state.oldestCursor; if (!cursor || this.#authors.length === 0) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const page = await loadOlderTimelinePage({ items: this.items(), authors: this.#authors, relays: this.#relays, subId: this.#noteSubId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return;
      this.#cached = page.items; this.#live = []; this.#olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined;
      this.#emit(this.#nextState({ items: this.items(), hasOlder: page.hasOlder, hasNewer: this.#state.hasNewer || page.hasNewer }));
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingOlder) this.#emit({ ...this.#state, loadingOlder: false }); }
  }
  async loadNewer(): Promise<void> {
    if (this.#closed || this.#state.loadingNewer || !this.#state.hasNewer) return; const generation = this.#generation; const cursor = this.#state.newestCursor; if (!cursor || this.#authors.length === 0) return;
    this.#emit({ ...this.#state, loadingNewer: true });
    try {
      const page = await this.#newerPage(cursor); this.#cached = mergeTimelineItems(page, this.items(), feedWindowSize);
      if (!this.#active(generation)) return;
      this.#emit(this.#nextState({ items: this.items(), hasNewer: page.length >= this.#pageSize }));
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingNewer) this.#emit({ ...this.#state, loadingNewer: false }); }
  }
  #subscribeFollows(pubkey: string): void { this.#emit({ ...this.#state, loading: true, status: 'loading-follows' }); this.#subscribe(this.#followSubId, [{ kinds: [3], authors: [pubkey], limit: 1 }]); }
  async #subscribeNotes(): Promise<void> {
    const initialPage = this.#loadInitialNotes();
    this.#routeRelays = await routedAuthorRelays({ authors: this.#authors, selectedRelays: this.#relays, purpose: 'write' });
    this.#subscribe(this.#noteSubId, authorFilters(this.#authors, this.#pageSize, { since: this.#startedAt }, 'per-filter'), this.#routeRelays);
    const missing = this.#authors.filter((pubkey) => !this.#profiles[pubkey]).slice(0, metadataPageLimit);
    const filters = profileFilter(missing); if (filters.length > 0) this.#subscribe(this.#metaSubId, filters);
    void initialPage.then(() => this.#discoverRoutesAfterInitial());
  }
  async #discoverRoutesAfterInitial(): Promise<void> {
    const generation = this.#generation;
    if (this.#closed) return;
    await discoverAuthorRelayRoutes({ authors: this.#authors, selectedRelays: this.#relays, key: `${this.#noteSubId}:routes`, subscriptions: this.#subscriptions }).catch(() => undefined);
    if (this.#active(generation)) await this.#refreshAfterRouteDiscovery(generation);
    if (this.#active(generation)) this.#startBackfill();
  }
  async #loadInitialNotes(): Promise<void> {
    const key = [...this.#authors].sort().join(',');
    if (this.#initialNotesKey === key || this.#authors.length === 0) return; this.#initialNotesKey = key;
    try {
      const page = await loadInitialTimelinePage({ authors: this.#authors, relays: this.#relays, subId: this.#noteSubId, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      this.#olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined;
      if (page.items.length > 0) { this.#cached = mergeTimelineItems(page.items, this.items(), feedWindowSize); this.#emit(this.#nextState(readyWithEventsState(this.#state, this.items()))); }
      else if (this.#state.items.length === 0) this.#emit(this.#nextState({ loading: false, status: 'ready-empty', hasOlder: page.hasOlder }));
    } catch (error) { this.#emit({ ...this.#state, loading: false, error: boundedErrorText(error) }); }
  }
  async #refreshAfterRouteDiscovery(generation: number): Promise<void> {
    if (this.#routeRefreshGeneration === generation || this.#authors.length === 0) return;
    this.#routeRefreshGeneration = generation;
    const page = await loadInitialTimelinePage({ authors: this.#authors, relays: this.#relays, subId: `${this.#noteSubId}:route-refresh`, pageSize: this.#pageSize, subscriptions: this.#subscriptions }).catch(() => undefined);
    if (!page || !this.#active(generation) || page.items.length === 0) return;
    const next = mergeTimelineItems(page.items, this.items(), feedWindowSize);
    if (next.map((item) => item.event.id).join(',') === this.items().map((item) => item.event.id).join(',')) return;
    this.#cached = next; this.#live = []; this.#olderScanCursor = page.hasOlder ? page.nextOlderCursor : this.#olderScanCursor;
    this.#emit(this.#nextState(readyWithEventsState(this.#state, this.items())));
  }
  #startBackfill(): void {
    if (this.#closed || this.#backfillStarted || this.#authors.length === 0) return;
    this.#backfillStarted = true;
    this.#cleanup.push(startTimelineBackfill({ items: () => this.items(), authors: this.#authors, relays: this.#relays, subId: this.#noteSubId, pageSize: this.#pageSize, subscriptions: this.#subscriptions }));
  }
  #subscribe(key: string, filters: readonly NostrFilter[], relays = this.#relays): void {
    if (this.#closed) return;
    this.#cleanup.push(this.#subscriptions.subscribeLive({ key, relays, filters, purpose: key === this.#metaSubId ? 'metadata' : 'feed' }, (event) => this.#receive(event)));
  }
  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (this.#closed) return;
    if (poolEvent.subId === this.#followSubId && poolEvent.event.kind === 3) return this.#receiveFollowList(poolEvent);
    if (poolEvent.subId === this.#metaSubId && poolEvent.event.kind === 0) return this.#receiveMetadata(poolEvent);
    if (poolEvent.subId !== this.#noteSubId || !isFeedDisplayKind(poolEvent.event.kind)) return; if (!this.#authors.includes(poolEvent.event.pubkey)) return;
    await upsertEvent(poolEvent.event, [poolEvent.relay]); this.#live = upsertLive(this.#live, poolEvent.event, poolEvent.relay);
    this.#emit(this.#withCursors(readyWithEventsState(this.#state, this.items())));
  }
  async #receiveFollowList(poolEvent: PoolEvent): Promise<void> {
    if (this.#closed) return;
    const event = poolEvent.event; const current = this.#followList;
    if (this.#followListId === event.id || (current && current.created_at > event.created_at)) { await upsertEvent(event, [poolEvent.relay]); return; }
    this.#followList = event; this.#followListId = event.id; this.#authors = accountHomeAuthors(event.pubkey, event);
    await upsertEvent(event, [poolEvent.relay]);
    if (this.#closed) return;
    if (this.#followListId !== event.id) return;
    this.#applyLoaded(await loadAccountHome(event.pubkey, event, this.#pageSize));
    if (this.#closed) return;
    this.#emit(this.#nextState({ items: this.items() })); this.#subscribeNotes();
  }
  async #receiveMetadata(poolEvent: PoolEvent): Promise<void> {
    if (this.#closed) return;
    if (!this.#authors.includes(poolEvent.event.pubkey)) return; await upsertEvent(poolEvent.event, [poolEvent.relay]);
    if (this.#closed) return;
    const profile = await storeTimelineProfile(poolEvent.event); this.#profiles = { ...this.#profiles, [poolEvent.event.pubkey]: profile };
    this.#emit(this.#nextState({ loading: false, error: null }));
  }
  #receiveState(snapshots: RelaySnapshot[]): void {
    if (this.#closed) return;
    const active = selectedRelaySnapshots(snapshots, this.#relays);
    if (needsSelfFallback(active, Boolean(this.#followList), this.#followFallbackStarted, this.#followSubId)) this.#handleMissingFollow();
    this.#emit({ ...this.#state, ...relayStatePatch(this.#state, active, this.#noteSubId) });
  }
  #handleMissingFollow(): void {
    if (this.#closed) return;
    this.#followFallbackStarted = true; this.#followList = undefined; this.#followListId = ''; this.#authors = [this.options.activeAccountPubkey ?? ''].filter(Boolean);
    this.#emit(noFollowListState(this.#state, this.#authors, this.#profiles)); this.#subscribeNotes();
  }
  async #startWithoutAccount(): Promise<void> {
    this.#cached = await loadCachedTimeline(this.#pageSize).catch(() => []);
    if (this.#closed) return;
    this.#emit(this.#withCursors(noActiveAccountState(this.#state, this.#cached)));
  }
  async #newerPage(cursor: FeedCursorPoint): Promise<TimelineItem[]> {
    const page = await queryFeed({ kind: 'home', authors: this.#authors, after: cursor, limit: this.#pageSize }); return [...page.items];
  }
  items(): TimelineItem[] { return mergeTimelineItems(this.#cached, this.#live, feedWindowSize); }
  #applyLoaded(loaded: TimelineLoad): void { this.#followList = loaded.followList; this.#authors = loaded.authors; this.#cached = loaded.cached; this.#profiles = loaded.profiles; }
  #withCursors(state: TimelineState): TimelineState { return { ...state, ...boundaryCursors(state.items) }; }
  #active(generation: number): boolean { return !this.#closed && generation === this.#generation; }
  #emit(state: TimelineState): void { if (this.#closed) return; this.#state = state; this.#listeners.forEach((listener) => listener(state)); void this.#hydrateVisibleProfiles(); }
  #nextState(patch: Partial<TimelineState>): TimelineState { return this.#withCursors({ ...this.#state, authors: this.#authors, profiles: this.#profiles, ...patch }); }
  async #hydrateVisibleProfiles(): Promise<void> {
    this.#profileCoordinator.merge(this.#profiles);
    const loaded = await this.#profileCoordinator.hydrate(this.#state.items);
    if (this.#closed || loaded === this.#profiles) return;
    this.#profiles = loaded; this.#emit({ ...this.#state, profiles: loaded });
  }
}
