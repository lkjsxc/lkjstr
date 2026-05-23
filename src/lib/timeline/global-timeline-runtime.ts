import { normalizeRelayUrl } from '../protocol';
import { queryFeed, upsertEvent } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import {
  boundaryCursors,
  feedPageSize,
  feedWindowSize,
  mergeFeedItems,
} from '../events/feed-window';
import { feedDisplayKinds, isFeedDisplayKind } from '../events/feed-kinds';
import type { PoolEvent } from '../relays/relay-pool';
import type { FeedCursorPoint } from '../events/types';
import { runtimeSubscriptions } from '../relays/runtime-subscriptions';
import type { RelaySubscriptionManager as SubscriptionManager } from '../relays/subscription-manager';
import { childRelaySubscriptionId } from '../relays/subscription-id';
import type { RelaySnapshot } from '../relays/types';
import {
  emptyState,
  noEnabledRelayState,
  readyWithEventsState,
  type TimelineRuntimeOptions,
  type TimelineState,
} from './timeline-state';
import { mergeTimelineItems, type TimelineItem } from './timeline-store';
import {
  relayStatePatch,
  selectedRelaySnapshots,
} from './timeline-relay-state';
import {
  loadInitialGlobalPage,
  loadOlderGlobalPage,
} from './global-timeline-pages';
import { TimelineProfileCoordinator } from './timeline-profile-coordinator';

export class GlobalTimelineRuntime {
  #cached: TimelineItem[] = [];
  #live: TimelineItem[] = [];
  #state: TimelineState = emptyState();
  #listeners = new Set<(state: TimelineState) => void>();
  #cleanup: (() => void)[] = [];
  #relays: string[];
  #limit: number;
  #pageSize: number;
  #subId: string;
  #subscriptions: SubscriptionManager;
  #profileCoordinator: TimelineProfileCoordinator;
  #olderScanCursor?: FeedCursorPoint;
  #startedAt = Math.floor(Date.now() / 1000);
  #closed = false;
  #generation = 0;

  constructor(readonly options: TimelineRuntimeOptions) {
    this.#subscriptions = runtimeSubscriptions(
      options.pool,
      options.subscriptions,
    );
    this.#subId = childRelaySubscriptionId(options.subId, 'notes');
    this.#pageSize = options.limit ?? feedPageSize;
    this.#limit = feedWindowSize;
    this.#relays = options.relays
      .map(normalizeRelayUrl)
      .filter((url): url is string => Boolean(url));
    this.#profileCoordinator = new TimelineProfileCoordinator(
      this.#relays,
      `${options.subId}:profiles`,
    );
  }

  subscribe(listener: (state: TimelineState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.#closed) return;
    const generation = ++this.#generation;
    this.#cached = [
      ...(await queryFeed({ kind: 'global', limit: this.#pageSize })).items,
    ];
    if (!this.#active(generation)) return;
    this.#emit(
      this.#cached.length > 0
        ? this.#nextState(readyWithEventsState(this.#state, this.#cached))
        : this.#nextState({ items: this.#cached }),
    );
    if (this.#relays.length === 0)
      return this.#emit(noEnabledRelayState(this.#state));
    this.#cleanup.push(
      this.#subscriptions.subscribeState((snapshots) =>
        this.#receiveState(snapshots),
      ),
      this.#subscriptions.subscribeLive(
        {
          key: this.#subId,
          relays: this.#relays,
          filters: [
            {
              kinds: feedDisplayKinds,
              since: this.#startedAt,
              limit: this.#pageSize,
            },
          ],
          purpose: 'feed',
        },
        (event) => this.#receive(event),
      ),
    );
    void this.#loadInitialPage();
  }

  close(): void {
    this.#closed = true;
    this.#generation++;
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#listeners.clear();
  }

  // prettier-ignore
  async loadOlder(): Promise<void> {
    if (this.#closed || this.#state.loadingOlder || !this.#state.hasOlder) return; const generation = this.#generation; const cursor = this.#olderScanCursor ?? this.#state.oldestCursor; if (!cursor) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const page = await loadOlderGlobalPage({ items: this.items(), relays: this.#relays, subId: this.#subId, cursor, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return; this.#cached = page.items; this.#live = []; this.#olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined;
      this.#emit(this.#nextState({ items: this.items(), hasOlder: page.hasOlder, hasNewer: this.#state.hasNewer || page.hasNewer }));
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingOlder) this.#emit({ ...this.#state, loadingOlder: false }); }
  }

  // prettier-ignore
  async loadNewer(): Promise<void> {
    if (this.#closed || this.#state.loadingNewer || !this.#state.hasNewer) return; const generation = this.#generation; const cursor = this.#state.newestCursor; if (!cursor) return;
    this.#emit({ ...this.#state, loadingNewer: true });
    try {
      const page = await queryFeed({ kind: 'global', after: cursor, limit: this.#pageSize });
      if (!this.#active(generation)) return;
      this.#cached = mergeTimelineItems(page.items, this.items(), this.#limit);
      this.#emit(this.#nextState({ items: this.items(), hasNewer: page.hasMore }));
    } finally { if (this.#state.loadingNewer) this.#emit({ ...this.#state, loadingNewer: false }); }
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    if (this.#closed) return;
    if (!isFeedDisplayKind(poolEvent.event.kind)) return;
    await upsertEvent(poolEvent.event, [poolEvent.relay]);
    if (this.#closed) return;
    this.#live = mergeFeedItems(this.#live, [
      { event: poolEvent.event, relays: [poolEvent.relay] },
    ]);
    this.#emit(readyWithEventsState(this.#state, this.items()));
  }

  // prettier-ignore
  async #loadInitialPage(): Promise<void> {
    const generation = this.#generation;
    try {
      const page = await loadInitialGlobalPage({ relays: this.#relays, subId: this.#subId, pageSize: this.#pageSize, subscriptions: this.#subscriptions });
      if (!this.#active(generation)) return; this.#olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined; this.#cached = mergeTimelineItems(page.items, this.items(), this.#limit);
      this.#emit(page.items.length > 0 ? this.#nextState(readyWithEventsState(this.#state, this.items())) : this.#nextState({ loading: false, hasOlder: page.hasOlder }));
    } catch (error) { this.#emit({ ...this.#state, loading: false, error: boundedErrorText(error) }); }
  }

  #receiveState(snapshots: RelaySnapshot[]): void {
    if (this.#closed) return;
    const active = selectedRelaySnapshots(snapshots, this.#relays);
    this.#emit({
      ...this.#state,
      ...relayStatePatch(this.#state, active, this.#subId),
    });
  }

  private items(): TimelineItem[] {
    return mergeTimelineItems(this.#cached, this.#live, this.#limit);
  }

  #emit(state: TimelineState): void {
    if (this.#closed) return;
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
    void this.#hydrateVisibleProfiles();
  }

  #active(generation: number): boolean {
    return !this.#closed && generation === this.#generation;
  }

  #nextState(patch: Partial<TimelineState>): TimelineState {
    const items = patch.items ?? this.#state.items;
    return { ...this.#state, ...boundaryCursors(items), ...patch };
  }

  async #hydrateVisibleProfiles(): Promise<void> {
    this.#profileCoordinator.merge(this.#state.profiles);
    const profiles = await this.#profileCoordinator.hydrate(this.#state.items);
    if (this.#closed || profiles === this.#state.profiles) return;
    this.#emit({ ...this.#state, profiles });
  }
}
