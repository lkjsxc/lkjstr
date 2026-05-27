import { describe, expect, it, vi } from 'vitest';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import { createTimelineNetworkSubs } from '../../../src/lib/timeline/timeline-runtime-network-subs';
import type { TimelineNetworkCtx } from '../../../src/lib/timeline/timeline-runtime-network-types';

vi.mock('../../../src/lib/relays/relay-routing', () => ({
  routedAuthorRelays: vi.fn(async () => ['relay-a.example']),
}));

vi.mock('../../../src/lib/relays/relay-discovery', () => ({
  discoverAuthorRelayRoutes: vi.fn(async () => undefined),
}));

describe('timeline network subs', () => {
  it('home live notes author filters include startup since', async () => {
    const startedAt = 1_000_000;
    const expectedSince = Math.max(0, startedAt - 30);
    const authors = ['a'.repeat(64), 'b'.repeat(64)];
    const initialKey = [...authors].sort().join(',');

    let capturedNotesFilters: unknown[] | undefined;
    const subscriptions = {
      subscribeDemand: vi.fn(
        (demand: { readonly channel: string; readonly filters: unknown[] }) => {
          if (demand.channel === 'notes') capturedNotesFilters = demand.filters;
          return () => undefined;
        },
      ),
    };

    const controller = new AbortController();

    const ctx = {
      surface: 'home',
      owner: 'test',
      subscriptions: subscriptions as unknown as SubscriptionOrchestrator,
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
      isActive: () => false,
      getGeneration: () => 1,
      items: () => [],
      getState: () => ({
        items: [],
        loading: true,
        error: null,
        status: 'loading-follows',
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
      }),
      emit: vi.fn(),
      nextState: (patch: Record<string, unknown>) => patch,
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
      getInitialNotesKey: () => initialKey,
      setInitialNotesKey: vi.fn(),
      getRouteRefreshGeneration: () => 0,
      setRouteRefreshGeneration: vi.fn(),
      applyLoaded: vi.fn(),
      withCursors: <T>(v: T) => v,
      setLive: vi.fn(),
      getLive: () => [],
    };

    const subs = createTimelineNetworkSubs(
      ctx as unknown as TimelineNetworkCtx,
    );
    await subs.subscribeNotes();

    expect(capturedNotesFilters).toBeDefined();
    expect(Array.isArray(capturedNotesFilters)).toBe(true);
    expect(
      (capturedNotesFilters ?? []).every(
        (f) => (f as { since?: number }).since === expectedSince,
      ),
    ).toBe(true);
  });
});
