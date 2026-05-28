import { normalizeRelayUrl } from '../protocol';
import { queryFeed, upsertEvent } from '../events/repository';
import { eventInDisplayBounds } from '../events/feed-display-bounds';
import {
  boundaryCursors,
  feedPageSize,
  feedWindowSize,
  mergeFeedWindowItems,
} from '../events/feed-window';
import { feedDisplayKinds, isFeedDisplayKind } from '../events/feed-kinds';
import type { PoolEvent } from '../relays/relay-pool';
import type { FeedCursorPoint } from '../events/types';
import { runtimeSubscriptions } from '../relays/runtime-subscriptions';
import type { DemandVisibility } from '../relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
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
import { runInitialGlobalPage } from './global-timeline-runtime-initial';
import {
  globalRuntimeLoadNewer,
  globalRuntimeLoadOlder,
  globalRuntimeSnapshot,
} from './global-timeline-runtime-handlers';
import { createTimelineProfileCoordinator } from './timeline-profile-coordinator';

export type GlobalTimelineRuntime = ReturnType<
  typeof createGlobalTimelineRuntime
>;

export function createGlobalTimelineRuntime(options: TimelineRuntimeOptions) {
  let cached: TimelineItem[] = [];
  let live: TimelineItem[] = [];
  let state: TimelineState = emptyState();
  const listeners = new Set<(state: TimelineState) => void>();
  const cleanup: (() => void)[] = [];
  const aborts = new AbortController();
  const relays = options.relays
    .map(normalizeRelayUrl)
    .filter((url): url is string => Boolean(url));
  const limit = feedWindowSize;
  const pageSize = options.limit ?? feedPageSize;
  const subId = childRelaySubscriptionId(options.subId, 'notes');
  const subscriptions: SubscriptionOrchestrator = runtimeSubscriptions(
    options.pool,
    options.subscriptions,
  );
  const owner = options.owner ?? options.subId;
  let visibility: DemandVisibility = 'visible';
  const profileCoordinator = createTimelineProfileCoordinator(
    relays,
    `${options.subId}:profiles`,
  );
  let olderScanCursor: FeedCursorPoint | undefined = options.seed?.oldestCursor;
  const startedAt = Math.floor(Date.now() / 1000);
  let closed = false;
  let generation = 0;

  const items = (): TimelineItem[] => mergeTimelineItems(cached, live, limit);
  const active = (run: number): boolean => !closed && generation === run;
  const nextState = (patch: Partial<TimelineState>): TimelineState => {
    const nextItems = patch.items ?? state.items;
    return { ...state, ...boundaryCursors(nextItems), ...patch };
  };
  const hydrateVisibleProfiles = async (): Promise<void> => {
    profileCoordinator.merge(state.profiles);
    const profiles = await profileCoordinator.hydrate(state.items);
    if (closed || profiles === state.profiles) return;
    emit({ ...state, profiles });
  };
  const emit = (next: TimelineState): void => {
    if (closed) return;
    state = next;
    listeners.forEach((listener) => listener(state));
    void hydrateVisibleProfiles();
  };
  // prettier-ignore
  const receive = async (poolEvent: PoolEvent): Promise<void> => {
    if (closed || !isFeedDisplayKind(poolEvent.event.kind)) return;
    await upsertEvent(poolEvent.event, [poolEvent.relay]);
    if (closed) return;
    if (!eventInDisplayBounds(poolEvent.event)) return;
    live = mergeFeedWindowItems(live, [{ event: poolEvent.event, relays: [poolEvent.relay] }], feedWindowSize);
    emit(readyWithEventsState(state, items()));
  };
  const loadInitialPage = async (): Promise<void> => {
    const run = generation;
    await runInitialGlobalPage({
      owner,
      relays,
      pageSize,
      subscriptions,
      limit,
      run,
      signal: aborts.signal,
      isActive: active,
      items,
      getState: () => state,
      getCached: () => cached,
      setCached: (v) => (cached = v),
      emit,
      nextState,
      setOlderScanCursor: (v) => (olderScanCursor = v),
    });
  };
  const receiveState = (snapshots: RelaySnapshot[]): void => {
    if (closed) return;
    emit({
      ...state,
      ...relayStatePatch(
        state,
        selectedRelaySnapshots(snapshots, relays),
        subId,
      ),
    });
  };
  const handlerCtx = {
    owner,
    relays,
    pageSize,
    limit,
    subscriptions,
    signal: aborts.signal,
    isClosed: () => closed,
    isActive: active,
    getGeneration: () => generation,
    items,
    getState: () => state,
    emit,
    nextState,
    setCached: (v: TimelineItem[]) => (cached = v),
    clearLive: () => (live = []),
    getOlderScanCursor: () => olderScanCursor,
    setOlderScanCursor: (v: FeedCursorPoint | undefined) =>
      (olderScanCursor = v),
  };
  // prettier-ignore
  const runtime = {
    subscribe: (listener: (state: TimelineState) => void): (() => void) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start: async (): Promise<void> => {
      if (closed) return; const run = ++generation; cached = [...(await queryFeed({ kind: 'global', limit: pageSize })).items]; if (!active(run)) return;
      const boot = cached.length > 0 ? readyWithEventsState(state, cached) : { ...state, items: cached };
      const seeded = options.seed
        ? {
            ...boot,
            hasOlder: options.seed.hasOlder ?? boot.hasOlder,
            hasNewer: options.seed.hasNewer ?? boot.hasNewer,
          }
        : boot;
      emit(nextState(seeded));
      if (relays.length === 0) return emit(noEnabledRelayState(state));
      cleanup.push(
        subscriptions.subscribeState(receiveState),
        subscriptions.submitLiveIntent(
          {
            surface: 'global',
            owner,
            channel: 'global:notes',
            visibility,
            selectedRelays: relays,
            filters: [{ kinds: feedDisplayKinds, since: startedAt, limit: pageSize }],
            purpose: 'feed',
            since: startedAt,
          },
          relays,
          (event) => void receive(event),
        ),
      );
      void loadInitialPage();
    },
    setVisibility: (visible: boolean): void => {
      visibility = visible ? 'visible' : 'hidden';
      if (visible) subscriptions.resumeOwner(owner);
      else subscriptions.pauseOwner(owner);
    },
    close: (): void => {
      closed = true;
      generation++;
      aborts.abort();
      subscriptions.releaseOwner(owner);
      for (const item of cleanup.splice(0)) item();
      listeners.clear();
    },
    loadOlder: () => globalRuntimeLoadOlder(handlerCtx),
    loadNewer: () => globalRuntimeLoadNewer(handlerCtx),
    snapshot: () => globalRuntimeSnapshot(handlerCtx),
  };
  return runtime;
}
