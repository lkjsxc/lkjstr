import { describe, expect, it, vi } from 'vitest';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import { createLiveDemandHandles } from '../../../src/lib/relays/orchestration/live-demand-handles';
import { routeGroupFingerprint } from '../../../src/lib/relays/orchestration/page-reads';
import type { RelayRouteGroup } from '../../../src/lib/relays/relay-route-types';
import { createTimelineNetworkSubs } from '../../../src/lib/timeline/timeline-runtime-network-subs';
import type { TimelineNetworkCtx } from '../../../src/lib/timeline/timeline-runtime-network-types';
import { timelineNetworkCtx } from './timeline-network-ctx-test-helper';

const relayRoutingMock = vi.hoisted(() => ({
  routedAuthorRelays: vi.fn(async () => ['relay-a.example']),
  routeGroupsForPaging: vi.fn<() => Promise<readonly RelayRouteGroup[]>>(
    async () => [],
  ),
}));

vi.mock('../../../src/lib/relays/relay-routing', () => ({
  routedAuthorRelays: relayRoutingMock.routedAuthorRelays,
  routeGroupsForPaging: relayRoutingMock.routeGroupsForPaging,
}));

vi.mock('../../../src/lib/relays/relay-discovery', () => ({
  discoverAuthorRelayRoutes: vi.fn(async () => undefined),
}));

describe('timeline network subs', () => {
  it('home live notes author filters include startup since', async () => {
    relayRoutingMock.routeGroupsForPaging.mockResolvedValue([]);
    const startedAt = 1_000_000;
    const expectedSince = Math.max(0, startedAt - 30);
    const authors = ['a'.repeat(64), 'b'.repeat(64)];
    const initialKey = [...authors].sort().join(',');

    let capturedNotesFilters: unknown[] | undefined;
    const subscriptions = {
      submitHomeNotesLiveIntent: vi.fn(
        async (intent: { readonly filters: unknown[] }) => {
          capturedNotesFilters = intent.filters;
          return () => undefined;
        },
      ),
      submitLiveIntent: vi.fn(() => () => undefined),
      readPageByIntent: vi.fn(async () => ({ events: [], statuses: [] })),
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
      routeRefresh: { generation: 0, homeNotesFingerprint: '' },
      liveHandles: createLiveDemandHandles(),
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

  it('replaces only the home notes live handle after route refresh', async () => {
    const authors = ['c'.repeat(64)];
    const oldGroups = [
      {
        key: 'fallback:0',
        relays: ['wss://selected.example/'],
        authors,
        source: 'fallback' as const,
      },
    ];
    const newGroups = [
      {
        key: `author:${authors[0]}`,
        relays: ['wss://route.example/'],
        authors,
        source: 'nip65' as const,
      },
    ];
    relayRoutingMock.routeGroupsForPaging
      .mockResolvedValueOnce(oldGroups)
      .mockResolvedValueOnce(oldGroups)
      .mockResolvedValueOnce(newGroups)
      .mockResolvedValue(newGroups);
    const initialRelease = vi.fn();
    const refreshedRelease = vi.fn();
    const handles = createLiveDemandHandles();
    const submitHomeNotesLiveIntent = vi
      .fn()
      .mockResolvedValueOnce(initialRelease)
      .mockResolvedValueOnce(refreshedRelease);

    const ctx = timelineNetworkCtx({
      authors,
      liveHandles: handles,
      routeRefresh: {
        generation: 0,
        homeNotesFingerprint: routeGroupFingerprint(oldGroups),
      },
      submitHomeNotesLiveIntent,
      readPageByIntent: vi.fn(async () => ({ events: [], statuses: [] })),
    });

    const subs = createTimelineNetworkSubs(ctx);
    await subs.subscribeNotes();
    await vi.waitFor(() => expect(initialRelease).toHaveBeenCalledOnce());

    expect(submitHomeNotesLiveIntent).toHaveBeenCalledTimes(2);
    expect(refreshedRelease).not.toHaveBeenCalled();
    handles.release('notes');
    expect(refreshedRelease).toHaveBeenCalledOnce();
  });
});
