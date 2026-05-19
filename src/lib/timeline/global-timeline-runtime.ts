import { normalizeRelayUrl } from '../protocol';
import { queryFeed, upsertEvent } from '../events/repository';
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
  #subId: string;
  #subscriptions: SubscriptionManager;

  constructor(readonly options: TimelineRuntimeOptions) {
    const pool: RelayPool = options.pool ?? sharedRelayPool;
    this.#subscriptions =
      options.subscriptions ?? new RelaySubscriptionManager(pool);
    this.#subId = `${options.subId}:notes`;
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
    this.#cached = [
      ...(await queryFeed({ kind: 'global', limit: this.#limit })).items,
    ];
    this.#emit(
      this.#cached.length > 0
        ? readyWithEventsState(this.#state, this.#cached)
        : { ...this.#state, items: this.#cached },
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
          filters: [{ kinds: [1], limit: this.#limit }],
        },
        (event) => this.#receive(event),
      ),
    );
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false });
  }

  async #receive(poolEvent: PoolEvent): Promise<void> {
    await upsertEvent(poolEvent.event, [poolEvent.relay]);
    this.#live = [
      ...this.#live,
      { event: poolEvent.event, relays: [poolEvent.relay] },
    ];
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
}
