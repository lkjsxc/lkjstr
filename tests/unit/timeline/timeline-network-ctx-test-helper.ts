import { vi } from 'vitest';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import type { createLiveDemandHandles } from '../../../src/lib/relays/orchestration/live-demand-handles';
import type { TimelineNetworkCtx } from '../../../src/lib/timeline/timeline-runtime-network-types';
import type { TimelineState } from '../../../src/lib/timeline/timeline-state';

export function timelineNetworkCtx(overrides: {
  readonly authors: readonly string[];
  readonly liveHandles: ReturnType<typeof createLiveDemandHandles>;
  readonly routeRefresh: TimelineNetworkCtx['routeRefresh'];
  readonly submitHomeNotesLiveIntent: SubscriptionOrchestrator['submitHomeNotesLiveIntent'];
  readonly readPageByIntent: SubscriptionOrchestrator['readPageByIntent'];
}): TimelineNetworkCtx {
  const startedAt = 1_000_000;
  const authors = [...overrides.authors];
  const subscriptions = {
    submitHomeNotesLiveIntent: overrides.submitHomeNotesLiveIntent,
    submitLiveIntent: vi.fn(() => () => undefined),
    readPageByIntent: overrides.readPageByIntent,
  } as unknown as SubscriptionOrchestrator;
  const controller = new AbortController();
  return {
    surface: 'home',
    owner: 'test',
    subscriptions,
    relays: ['wss://selected-relay.example'],
    pageSize: 30,
    noteSubId: 'notes:sub',
    metaSubId: 'meta:sub',
    followSubId: 'follows:sub',
    setProfiles: vi.fn(),
    startedAt,
    activeAccountPubkey: 'a'.repeat(64),
    cleanup: () => [],
    signal: controller.signal,
    visibility: () => 'visible',
    isClosed: () => false,
    isActive: () => true,
    getGeneration: () => 1,
    items: () => [],
    getState: emptyTimelineState,
    emit: vi.fn(),
    nextState: (patch: Partial<TimelineState>): TimelineState => ({
      ...emptyTimelineState(),
      ...patch,
    }),
    getAuthors: () => authors,
    setAuthors: vi.fn(),
    getProfiles: () => ({}),
    getFollowList: () => undefined,
    setFollowList: vi.fn(),
    getFollowListId: () => '',
    setFollowListId: vi.fn(),
    setFollowFallbackStarted: vi.fn(),
    getFollowFallbackStarted: () => false,
    getCached: () => [],
    setCached: vi.fn(),
    clearLive: vi.fn(),
    getOlderScanCursor: () => undefined,
    setOlderScanCursor: vi.fn(),
    getInitialNotesKey: () => authors.join(','),
    setInitialNotesKey: vi.fn(),
    routeRefresh: overrides.routeRefresh,
    liveHandles: overrides.liveHandles,
    applyLoaded: vi.fn(),
    withCursors: (v) => v,
    setLive: vi.fn(),
    getLive: () => [],
  };
}

function emptyTimelineState(): TimelineState {
  return {
    items: [],
    loading: true,
    error: null,
    status: 'loading-follows' as const,
    connectedRelays: 0,
    eoseRelays: 0,
    authors: [],
    profiles: {},
    diagnostics: [],
    loadingOlder: false,
    loadingNewer: false,
    hasOlder: true,
    hasNewer: false,
    oldestCursor: undefined,
    newestCursor: undefined,
  };
}
