import { normalizeRelayUrl, type NostrFilter } from '../protocol';
import {
  boundaryCursors,
  feedPageSize,
  feedWindowSize,
  metadataPageLimit,
} from '../events/feed-window';
import { queryFeed, upsertEvent } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import { sharedRelayPool, type PoolEvent } from '../relays/relay-pool';
import { RelaySubscriptionManager } from '../relays/subscription-manager';
import type { RelaySnapshot } from '../relays/types';
import { authorFilters } from './follow-list';
import { loadAccountHome, loadCachedAccountHome } from './timeline-load';
import type { TimelineLoad } from './timeline-load';
import { loadOlderTimelinePage } from './timeline-runtime-paging';
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

// prettier-ignore
export class TimelineRuntime {
  #subscriptions: RelaySubscriptionManager; #cached: TimelineItem[] = []; #live: TimelineItem[] = [];
  #state: TimelineState = emptyState(); #listeners = new Set<(state: TimelineState) => void>(); #cleanup: (() => void)[] = [];
  #relays: string[]; #pageSize: number; #authors: string[] = []; #profiles: TimelineState['profiles'] = {};
  #followList?: TimelineLoad['followList']; #followFallbackStarted = false; #followSubId: string; #metaSubId: string; #noteSubId: string;
  #startedAt = Math.floor(Date.now() / 1000);
  constructor(readonly options: TimelineRuntimeOptions) {
    const pool = options.pool ?? sharedRelayPool; this.#subscriptions = options.subscriptions ?? new RelaySubscriptionManager(pool);
    this.#followSubId = `${options.subId}:follows`; this.#metaSubId = `${options.subId}:meta`; this.#noteSubId = `${options.subId}:notes`;
    this.#pageSize = options.limit ?? feedPageSize; this.#relays = options.relays.map(normalizeRelayUrl).filter((url): url is string => Boolean(url));
  }
  subscribe(listener: (state: TimelineState) => void): () => void { this.#listeners.add(listener); listener(this.#state); return () => this.#listeners.delete(listener); }
  async start(): Promise<void> {
    const pubkey = this.options.activeAccountPubkey; if (!pubkey) return this.#startWithoutAccount();
    const loaded = await loadCachedAccountHome(pubkey, this.#pageSize).catch(() => ({ authors: [pubkey], cached: [], profiles: {} }));
    this.#applyLoaded(loaded); const state = this.#cached.length > 0 ? readyWithEventsState(this.#state, this.#cached) : { ...this.#state, items: this.#cached };
    this.#emit(this.#withCursors(state)); if (this.#relays.length === 0) return this.#emit(noEnabledRelayState(this.#state));
    this.#cleanup.push(this.#subscriptions.subscribeState((snapshots) => this.#receiveState(snapshots)));
    if (this.#followList) this.#subscribeNotes(); else this.#subscribeFollows(pubkey);
  }
  close(): void { for (const cleanup of this.#cleanup.splice(0)) cleanup(); this.#emit({ ...this.#state, loading: false, loadingOlder: false, loadingNewer: false }); }
  async loadOlder(): Promise<void> {
    if (this.#state.loadingOlder || !this.#state.hasOlder) return; const cursor = this.#state.oldestCursor; if (!cursor || this.#authors.length === 0) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const page = await loadOlderTimelinePage({ items: this.items(), authors: this.#authors, relays: this.#relays, subId: this.#noteSubId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      this.#cached = page.items; this.#live = [];
      this.#emit(this.#nextState({ items: this.items(), hasOlder: page.hasOlder, hasNewer: this.#state.hasNewer || page.hasNewer }));
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingOlder) this.#emit({ ...this.#state, loadingOlder: false }); }
  }
  async loadNewer(): Promise<void> {
    if (this.#state.loadingNewer || !this.#state.hasNewer) return; const cursor = this.#state.newestCursor; if (!cursor || this.#authors.length === 0) return;
    this.#emit({ ...this.#state, loadingNewer: true });
    try {
      const page = await this.#newerPage(cursor); this.#cached = mergeTimelineItems(page, this.items(), feedWindowSize);
      this.#emit(this.#nextState({ items: this.items(), hasNewer: page.length >= this.#pageSize }));
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingNewer) this.#emit({ ...this.#state, loadingNewer: false }); }
  }
  #subscribeFollows(pubkey: string): void { this.#emit({ ...this.#state, loading: true, status: 'loading-follows' }); this.#subscribe(this.#followSubId, [{ kinds: [3], authors: [pubkey], limit: 1 }]); }
  #subscribeNotes(): void {
    this.#subscribe(this.#noteSubId, authorFilters(this.#authors, this.#pageSize, { since: this.#startedAt }));
    const missing = this.#authors.filter((pubkey) => !this.#profiles[pubkey]).slice(0, metadataPageLimit);
    const filters = profileFilter(missing); if (filters.length > 0) this.#subscribe(this.#metaSubId, filters);
  }
  #subscribe(key: string, filters: readonly NostrFilter[]): void {
    this.#cleanup.push(this.#subscriptions.subscribeLive({ key, relays: this.#relays, filters }, (event) => this.#receive(event)));
  }
  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId === this.#followSubId && poolEvent.event.kind === 3) return this.#receiveFollowList(poolEvent);
    if (poolEvent.subId === this.#metaSubId && poolEvent.event.kind === 0) return this.#receiveMetadata(poolEvent);
    if (poolEvent.subId !== this.#noteSubId || poolEvent.event.kind !== 1) return; if (!this.#authors.includes(poolEvent.event.pubkey)) return;
    await upsertEvent(poolEvent.event, [poolEvent.relay]); this.#live = upsertLive(this.#live, poolEvent.event, poolEvent.relay);
    this.#emit(this.#withCursors(readyWithEventsState(this.#state, this.items())));
  }
  async #receiveFollowList(poolEvent: PoolEvent): Promise<void> {
    const event = poolEvent.event; await upsertEvent(event, [poolEvent.relay]); this.#applyLoaded(await loadAccountHome(event.pubkey, event, this.#pageSize));
    this.#emit(this.#nextState({ items: this.items() })); this.#subscribeNotes();
  }
  async #receiveMetadata(poolEvent: PoolEvent): Promise<void> {
    if (!this.#authors.includes(poolEvent.event.pubkey)) return; await upsertEvent(poolEvent.event, [poolEvent.relay]);
    const profile = await storeTimelineProfile(poolEvent.event); this.#profiles = { ...this.#profiles, [poolEvent.event.pubkey]: profile };
    this.#emit(this.#nextState({ loading: false, error: null }));
  }
  #receiveState(snapshots: RelaySnapshot[]): void {
    const active = selectedRelaySnapshots(snapshots, this.#relays);
    if (needsSelfFallback(active, Boolean(this.#followList), this.#followFallbackStarted, this.#followSubId)) this.#handleMissingFollow();
    this.#emit({ ...this.#state, ...relayStatePatch(this.#state, active, this.#noteSubId) });
  }
  #handleMissingFollow(): void {
    this.#followFallbackStarted = true; this.#followList = undefined; this.#authors = [this.options.activeAccountPubkey ?? ''].filter(Boolean);
    this.#emit(noFollowListState(this.#state, this.#authors, this.#profiles)); this.#subscribeNotes();
  }
  async #startWithoutAccount(): Promise<void> {
    this.#cached = await loadCachedTimeline(this.#pageSize).catch(() => []);
    this.#emit(this.#withCursors(noActiveAccountState(this.#state, this.#cached)));
  }
  async #newerPage(cursor: FeedCursorPoint): Promise<TimelineItem[]> {
    const page = await queryFeed({ kind: 'home', authors: this.#authors, after: cursor, limit: this.#pageSize }); return [...page.items];
  }
  items(): TimelineItem[] { return mergeTimelineItems(this.#cached, this.#live, feedWindowSize); }
  #applyLoaded(loaded: TimelineLoad): void { this.#followList = loaded.followList; this.#authors = loaded.authors; this.#cached = loaded.cached; this.#profiles = loaded.profiles; }
  #withCursors(state: TimelineState): TimelineState { return { ...state, ...boundaryCursors(state.items) }; }
  #emit(state: TimelineState): void { this.#state = state; this.#listeners.forEach((listener) => listener(state)); }
  #nextState(patch: Partial<TimelineState>): TimelineState { return this.#withCursors({ ...this.#state, authors: this.#authors, profiles: this.#profiles, ...patch }); }
}
