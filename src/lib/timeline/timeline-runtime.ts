import { normalizeRelayUrl } from '../protocol';
import {
  sharedRelayPool,
  type PoolEvent,
  type RelayPool,
} from '../relays/relay-pool';
import { authorFilters } from './follow-list';
import {
  loadAccountHome,
  loadCachedAccountHome,
  type TimelineLoad,
} from './timeline-load';
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
import {
  loadCachedTimeline,
  mergeTimelineItems,
  storeTimelineEvent,
  type TimelineItem,
} from './timeline-store';

export class TimelineRuntime {
  #pool: RelayPool;
  #cached: TimelineItem[] = [];
  #live: TimelineItem[] = [];
  #state: TimelineState = emptyState();
  #listeners = new Set<(state: TimelineState) => void>();
  #cleanup: (() => void)[] = [];
  #relays: string[];
  #limit: number;
  #authors: string[] = [];
  #profiles: TimelineState['profiles'] = {};
  #followList?: TimelineLoad['followList'];
  #followFallbackStarted = false;
  #followSubId: string;
  #metaSubId: string;
  #noteSubId: string;

  constructor(readonly options: TimelineRuntimeOptions) {
    this.#pool = options.pool ?? sharedRelayPool;
    this.#followSubId = `${options.subId}:follows`;
    this.#metaSubId = `${options.subId}:meta`;
    this.#noteSubId = `${options.subId}:notes`;
    this.#limit = options.limit ?? 50;
    this.#relays = options.relays
      .map(normalizeRelayUrl)
      .filter((url): url is string => Boolean(url));
  }

  subscribe(listener: (state: TimelineState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    const pubkey = this.options.activeAccountPubkey;
    if (!pubkey) {
      this.#cached = await loadCachedTimeline(this.#limit);
      this.#emit(noActiveAccountState(this.#state, this.#cached));
      return;
    }
    const loaded = await loadCachedAccountHome(pubkey, this.#limit);
    this.#applyLoaded(loaded);
    this.#emit(this.#nextState({ items: this.#cached }));
    if (this.#relays.length === 0) {
      this.#emit(noEnabledRelayState(this.#state));
      return;
    }
    this.#cleanup.push(
      this.#pool.onEvent((event) => this.#receive(event)),
      this.#pool.onState((snapshots) => this.#receiveState(snapshots)),
    );
    if (this.#followList) this.#subscribeNotes();
    else this.#subscribeFollows(pubkey);
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false });
  }

  #subscribeFollows(pubkey: string): void {
    this.#emit({ ...this.#state, loading: true, status: 'loading-follows' });
    this.#cleanup.push(
      this.#pool.subscribe(this.#relays, this.#followSubId, [
        { kinds: [3], authors: [pubkey], limit: 1 },
      ]),
    );
  }

  #subscribeNotes(): void {
    this.#cleanup.push(
      this.#pool.subscribe(
        this.#relays,
        this.#noteSubId,
        authorFilters(this.#authors, this.#limit),
      ),
    );
    const filters = profileFilter(this.#authors);
    if (filters.length > 0)
      this.#cleanup.push(
        this.#pool.subscribe(this.#relays, this.#metaSubId, filters),
      );
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (poolEvent.subId === this.#followSubId && poolEvent.event.kind === 3)
      return this.#receiveFollowList(poolEvent.event);
    if (poolEvent.subId === this.#metaSubId && poolEvent.event.kind === 0)
      return this.#receiveMetadata(poolEvent.event);
    if (poolEvent.subId !== this.#noteSubId || poolEvent.event.kind !== 1)
      return;
    if (!this.#authors.includes(poolEvent.event.pubkey)) return;
    await storeTimelineEvent(poolEvent.event);
    this.#live = upsertLive(this.#live, poolEvent.event, poolEvent.relay);
    this.#emit(readyWithEventsState(this.#state, this.items()));
  }

  async #receiveFollowList(event: PoolEvent['event']): Promise<void> {
    await storeTimelineEvent(event);
    this.#applyLoaded(await loadAccountHome(event.pubkey, event, this.#limit));
    this.#emit(this.#nextState({ items: this.items() }));
    this.#subscribeNotes();
  }

  async #receiveMetadata(event: PoolEvent['event']): Promise<void> {
    if (!this.#authors.includes(event.pubkey)) return;
    const profile = await storeTimelineProfile(event);
    this.#profiles = { ...this.#profiles, [event.pubkey]: profile };
    this.#emit(this.#nextState({ loading: false, error: null }));
  }

  #receiveState(snapshots: ReturnType<RelayPool['snapshots']>): void {
    const active = selectedRelaySnapshots(snapshots, this.#relays);
    if (
      needsSelfFallback(
        active,
        Boolean(this.#followList),
        this.#followFallbackStarted,
        this.#followSubId,
      )
    )
      this.#handleMissingFollow();
    this.#emit({
      ...this.#state,
      ...relayStatePatch(this.#state, active, this.#noteSubId),
    });
  }

  #handleMissingFollow(): void {
    this.#followFallbackStarted = true;
    this.#followList = undefined;
    this.#authors = [this.options.activeAccountPubkey ?? ''].filter(Boolean);
    this.#emit(noFollowListState(this.#state, this.#authors, this.#profiles));
    this.#subscribeNotes();
  }

  private items(): TimelineItem[] {
    return mergeTimelineItems(this.#cached, this.#live, this.#limit);
  }

  #applyLoaded(loaded: TimelineLoad): void {
    this.#followList = loaded.followList;
    this.#authors = loaded.authors;
    this.#cached = loaded.cached;
    this.#profiles = loaded.profiles;
  }

  #emit(state: TimelineState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
  }

  #nextState(patch: Partial<TimelineState>): TimelineState {
    return {
      ...this.#state,
      authors: this.#authors,
      profiles: this.#profiles,
      ...patch,
    };
  }
}
