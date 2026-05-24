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
  loadNewerGlobalPage,
  loadOlderGlobalPage,
} from './global-timeline-pages';
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
  const relays = options.relays
    .map(normalizeRelayUrl)
    .filter((url): url is string => Boolean(url));
  const limit = feedWindowSize;
  const pageSize = options.limit ?? feedPageSize;
  const subId = childRelaySubscriptionId(options.subId, 'notes');
  const subscriptions: SubscriptionManager = runtimeSubscriptions(
    options.pool,
    options.subscriptions,
  );
  const profileCoordinator = createTimelineProfileCoordinator(
    relays,
    `${options.subId}:profiles`,
  );
  let olderScanCursor: FeedCursorPoint | undefined;
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
    live = mergeFeedItems(live, [{ event: poolEvent.event, relays: [poolEvent.relay] }]);
    emit(readyWithEventsState(state, items()));
  };
  // prettier-ignore
  const loadInitialPage = async (): Promise<void> => {
    const run = generation;
    try {
      const page = await loadInitialGlobalPage({ relays, subId, pageSize, subscriptions });
      if (!active(run)) return;
      olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined;
      cached = mergeTimelineItems(page.items, items(), limit);
      emit(page.items.length > 0 ? nextState(readyWithEventsState(state, items())) : nextState({ loading: false, hasOlder: page.hasOlder }));
    } catch (error) {
      emit({ ...state, loading: false, error: boundedErrorText(error) });
    }
  };
  const receiveState = (snapshots: RelaySnapshot[]): void => {
    if (closed) return;
    const activeRelays = selectedRelaySnapshots(snapshots, relays);
    emit({ ...state, ...relayStatePatch(state, activeRelays, subId) });
  };
  // prettier-ignore
  const runtime = {
    subscribe: (listener: (state: TimelineState) => void): (() => void) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start: async (): Promise<void> => {
      if (closed) return; const run = ++generation; cached = [...(await queryFeed({ kind: 'global', limit: pageSize })).items]; if (!active(run)) return;
      emit(cached.length > 0 ? nextState(readyWithEventsState(state, cached)) : nextState({ items: cached }));
      if (relays.length === 0) return emit(noEnabledRelayState(state));
      cleanup.push(subscriptions.subscribeState(receiveState), subscriptions.subscribeLive({ key: subId, relays, filters: [{ kinds: feedDisplayKinds, since: startedAt, limit: pageSize }], purpose: 'feed' }, (event) => receive(event)));
      void loadInitialPage();
    },
    close: (): void => { closed = true; generation++; for (const item of cleanup.splice(0)) item(); listeners.clear(); },
    loadOlder: async (): Promise<void> => {
      if (closed || state.loadingOlder || !state.hasOlder) return; const run = generation; const cursor = olderScanCursor ?? state.oldestCursor; if (!cursor) return; emit({ ...state, loadingOlder: true });
      try { const page = await loadOlderGlobalPage({ items: items(), relays, subId, cursor, pageSize, subscriptions }); if (!active(run)) return; cached = page.items; live = []; olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined; emit(nextState({ items: items(), hasOlder: page.hasOlder, hasNewer: state.hasNewer || page.hasNewer })); }
      catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingOlder) emit({ ...state, loadingOlder: false }); }
    },
    loadNewer: async (): Promise<void> => {
      if (closed || state.loadingNewer || !state.hasNewer) return; const run = generation; const cursor = state.newestCursor; if (!cursor) return; emit({ ...state, loadingNewer: true });
      try { const page = await loadNewerGlobalPage({ items: items(), relays, subId, cursor, pageSize, subscriptions }); if (!active(run)) return; cached = page.items; live = []; emit(nextState({ items: items(), hasNewer: page.hasNewer, hasOlder: state.hasOlder || page.hasOlder })); }
      finally { if (state.loadingNewer) emit({ ...state, loadingNewer: false }); }
    },
  };
  return runtime;
}
