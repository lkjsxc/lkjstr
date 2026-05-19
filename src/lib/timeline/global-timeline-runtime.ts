import { normalizeRelayUrl } from '../protocol';
import { queryFeed, upsertEvent } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import {
  boundaryCursors,
  feedPageSize,
  feedWindowSize,
  mergeFeedItems,
  mergeFeedWindow,
} from '../events/feed-window';
import {
  sharedRelayPool,
  type PoolEvent,
  type RelayPool,
} from '../relays/relay-pool';
import {
  RelaySubscriptionManager,
  type RelaySubscriptionManager as SubscriptionManager,
} from '../relays/subscription-manager';
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
  #startedAt = Math.floor(Date.now() / 1000);

  constructor(readonly options: TimelineRuntimeOptions) {
    const pool: RelayPool = options.pool ?? sharedRelayPool;
    this.#subscriptions =
      options.subscriptions ?? new RelaySubscriptionManager(pool);
    this.#subId = `${options.subId}:notes`;
    this.#pageSize = options.limit ?? feedPageSize;
    this.#limit = feedWindowSize;
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
    this.#cached = [
      ...(await queryFeed({ kind: 'global', limit: this.#pageSize })).items,
    ];
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
            { kinds: [1], since: this.#startedAt, limit: this.#pageSize },
          ],
        },
        (event) => this.#receive(event),
      ),
    );
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false });
  }

  async loadOlder(): Promise<void> {
    if (this.#state.loadingOlder || !this.#state.hasOlder) return;
    const cursor = this.#state.oldestCursor;
    if (!cursor) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const page = await queryFeed({
        kind: 'global',
        before: cursor,
        limit: this.#pageSize,
      });
      const relayEvents =
        this.#relays.length > 0
          ? await this.#subscriptions.readPage(
              {
                key: `${this.#subId}:older:${cursor.createdAt}:${cursor.id}`,
                relays: this.#relays,
                filters: [
                  {
                    kinds: [1],
                    until: cursor.createdAt,
                    limit: this.#pageSize,
                  },
                ],
              },
              { timeoutMs: 5000 },
            )
          : [];
      await Promise.all(
        relayEvents.map((item) => upsertEvent(item.event, [item.relay])),
      );
      const older = [
        ...page.items,
        ...relayEvents.map((item) => ({
          event: item.event,
          relays: [item.relay],
        })),
      ];
      const window = mergeFeedWindow(this.items(), older, this.#limit, true);
      this.#cached = window.items;
      this.#live = [];
      this.#emit(
        this.#nextState({
          items: this.items(),
          hasOlder: page.hasMore || relayEvents.length >= this.#pageSize,
          hasNewer: this.#state.hasNewer || window.prunedNewer,
        }),
      );
    } catch (error) {
      this.#emit({ ...this.#state, error: boundedErrorText(error) });
    } finally {
      if (this.#state.loadingOlder)
        this.#emit({ ...this.#state, loadingOlder: false });
    }
  }

  // prettier-ignore
  async loadNewer(): Promise<void> {
    if (this.#state.loadingNewer || !this.#state.hasNewer) return; const cursor = this.#state.newestCursor; if (!cursor) return;
    this.#emit({ ...this.#state, loadingNewer: true });
    try {
      const page = await queryFeed({ kind: 'global', after: cursor, limit: this.#pageSize });
      this.#cached = mergeTimelineItems(page.items, this.items(), this.#limit);
      this.#emit(this.#nextState({ items: this.items(), hasNewer: page.hasMore }));
    } finally { if (this.#state.loadingNewer) this.#emit({ ...this.#state, loadingNewer: false }); }
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    await upsertEvent(poolEvent.event, [poolEvent.relay]);
    this.#live = mergeFeedItems(this.#live, [
      { event: poolEvent.event, relays: [poolEvent.relay] },
    ]);
    this.#emit(readyWithEventsState(this.#state, this.items()));
  }

  #receiveState(snapshots: ReturnType<RelayPool['snapshots']>): void {
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
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
  }

  #nextState(patch: Partial<TimelineState>): TimelineState {
    const items = patch.items ?? this.#state.items;
    return {
      ...this.#state,
      ...boundaryCursors(items),
      ...patch,
    };
  }
}
