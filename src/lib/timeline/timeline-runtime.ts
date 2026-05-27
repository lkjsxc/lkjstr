import { normalizeRelayUrl } from '../protocol';
import {
  boundaryCursors,
  feedPageSize,
  feedWindowSize,
} from '../events/feed-window';
import { runtimeSubscriptions } from '../relays/runtime-subscriptions';
import type { DemandVisibility } from '../relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { childRelaySubscriptionId } from '../relays/subscription-id';
import { type TimelineLoad } from './timeline-load';
import {
  emptyState,
  type TimelineRuntimeOptions,
  type TimelineState,
} from './timeline-state';
import { mergeTimelineItems, type TimelineItem } from './timeline-store';
import { createTimelineProfileCoordinator } from './timeline-profile-coordinator';
import { timelineRuntimePagingApi } from './timeline-runtime-api';
import { bindTimelineRuntimeNetwork } from './timeline-runtime-bind';
import { startTimelineRuntime } from './timeline-runtime-start';
export type TimelineRuntime = ReturnType<typeof createTimelineRuntime>;

export function createTimelineRuntime(options: TimelineRuntimeOptions) {
  const subscriptions: SubscriptionOrchestrator = runtimeSubscriptions(
    options.pool,
    options.subscriptions,
  );
  const owner = options.owner ?? options.subId;
  const surface = options.kind === 'global' ? 'global' : 'home';
  let visibility: DemandVisibility = 'visible';
  let cached: TimelineItem[] = [];
  let live: TimelineItem[] = [];
  let state: TimelineState = emptyState();
  const listeners = new Set<(state: TimelineState) => void>();
  const cleanup: (() => void)[] = [];
  const aborts = new AbortController();
  const relays = options.relays
    .map(normalizeRelayUrl)
    .filter((url): url is string => Boolean(url));
  let authors: string[] = [];
  const pageSize = options.limit ?? feedPageSize;
  let profiles: TimelineState['profiles'] = {};
  let olderScanCursor = options.seed?.oldestCursor;
  let followListId = '';
  let initialNotesKey = '';
  let followList: TimelineLoad['followList'];
  let followFallbackStarted = false;
  const followSubId = childRelaySubscriptionId(options.subId, 'follows');
  const metaSubId = childRelaySubscriptionId(options.subId, 'meta');
  const noteSubId = childRelaySubscriptionId(options.subId, 'notes');
  const profileCoordinator = createTimelineProfileCoordinator(
    relays,
    metaSubId,
  );
  let closed = false;
  let generation = 0;
  const items = (): TimelineItem[] =>
    mergeTimelineItems(cached, live, feedWindowSize);
  const active = (run: number): boolean => !closed && run === generation;
  const withCursors = (next: TimelineState): TimelineState => ({
    ...next,
    ...boundaryCursors(next.items),
  });
  const nextState = (patch: Partial<TimelineState>): TimelineState =>
    withCursors({ ...state, authors, profiles, ...patch });
  const hydrateVisibleProfiles = async (): Promise<void> => {
    profileCoordinator.merge(profiles);
    const loaded = await profileCoordinator.hydrate(state.items);
    if (closed || loaded === profiles) return;
    profiles = loaded;
    emit({ ...state, profiles: loaded });
  };
  const emit = (next: TimelineState): void => {
    if (closed) return;
    state = next;
    listeners.forEach((listener) => listener(state));
    void hydrateVisibleProfiles();
  };
  const applyLoaded = (loaded: TimelineLoad): void => {
    followList = loaded.followList;
    authors = loaded.authors;
    cached = loaded.cached;
    profiles = loaded.profiles;
  };
  const network = bindTimelineRuntimeNetwork({
    surface,
    owner,
    subscriptions,
    relays,
    pageSize,
    noteSubId,
    metaSubId,
    followSubId,
    activeAccountPubkey: options.activeAccountPubkey,
    cleanup: () => cleanup,
    signal: aborts.signal,
    visibility: () => visibility,
    isClosed: () => closed,
    isActive: active,
    getGeneration: () => generation,
    items,
    getState: () => state,
    emit,
    nextState,
    getAuthors: () => authors,
    setAuthors: (v) => (authors = v),
    getProfiles: () => profiles,
    setProfiles: (v) => (profiles = v),
    getFollowList: () => followList,
    setFollowList: (v) => (followList = v),
    getFollowListId: () => followListId,
    setFollowListId: (v) => (followListId = v),
    setFollowFallbackStarted: (v) => (followFallbackStarted = v),
    getFollowFallbackStarted: () => followFallbackStarted,
    getCached: () => cached,
    setCached: (v) => (cached = v),
    clearLive: () => (live = []),
    getOlderScanCursor: () => olderScanCursor,
    setOlderScanCursor: (v) => (olderScanCursor = v),
    getInitialNotesKey: () => initialNotesKey,
    setInitialNotesKey: (v) => (initialNotesKey = v),
    applyLoaded,
    withCursors,
    setLive: (v) => (live = v),
    getLive: () => live,
  });

  return {
    subscribe: (listener: (state: TimelineState) => void): (() => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    start: async (): Promise<void> => {
      if (closed) return;
      const run = ++generation;
      await startTimelineRuntime({
        options,
        subscriptions,
        network,
        pageSize,
        relays,
        run,
        isClosed: () => closed,
        isActive: active,
        applyLoaded,
        getCached: () => cached,
        setCached: (v) => (cached = v),
        emit,
        withCursors,
        getState: () => state,
        getFollowList: () => followList,
        cleanup: () => cleanup,
      });
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
    ...timelineRuntimePagingApi({
      surface,
      owner,
      isClosed: () => closed,
      isActive: active,
      getState: () => state,
      emit,
      nextState,
      items,
      authors: () => authors,
      relays,
      noteSubId,
      pageSize,
      subscriptions,
      signal: aborts.signal,
      getOlderScanCursor: () => olderScanCursor,
      setOlderScanCursor: (v) => (olderScanCursor = v),
      setCached: (v) => (cached = v),
      clearLive: () => (live = []),
      getGeneration: () => generation,
      bumpGeneration: () => ++generation,
    }),
    items,
    retryFollowDiscovery:
      surface === 'home' ? network.retryFollowDiscovery : undefined,
  };
}
