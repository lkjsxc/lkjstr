import { normalizeRelayUrl, type NostrFilter } from '../protocol';
// prettier-ignore
import { boundaryCursors, feedPageSize, feedWindowSize, metadataPageLimit } from '../events/feed-window';
import { upsertEvent } from '../events/repository';
import { isFeedDisplayKind } from '../events/feed-kinds';
import { boundedErrorText } from '../events/runtime-error';
import type { FeedCursorPoint } from '../events/types';
import type { PoolEvent } from '../relays/relay-pool';
import { discoverAuthorRelayRoutes } from '../relays/relay-discovery';
import { runtimeSubscriptions } from '../relays/runtime-subscriptions';
import { routedAuthorRelays } from '../relays/relay-routing';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import { childRelaySubscriptionId } from '../relays/subscription-id';
import type { RelaySnapshot } from '../relays/types';
import { accountHomeAuthors, authorFilters } from './follow-list';
import { loadAccountHome, loadCachedAccountHome } from './timeline-load';
import type { TimelineLoad } from './timeline-load';
// prettier-ignore
import {
  loadInitialTimelinePage,
  loadNewerTimelinePage,
  loadOlderTimelinePage,
} from './timeline-runtime-paging';
import { profileFilter, storeTimelineProfile } from './timeline-profiles';
// prettier-ignore
import { needsSelfFallback, relayStatePatch, selectedRelaySnapshots } from './timeline-relay-state';
// prettier-ignore
import { emptyState, noActiveAccountState, noEnabledRelayState, noFollowListState, readyWithEventsState, upsertLive, type TimelineRuntimeOptions, type TimelineState } from './timeline-state';
import { loadCachedTimeline, mergeTimelineItems } from './timeline-store';
import type { TimelineItem } from './timeline-store';
import { createTimelineProfileCoordinator } from './timeline-profile-coordinator';

export type TimelineRuntime = ReturnType<typeof createTimelineRuntime>;

export function createTimelineRuntime(options: TimelineRuntimeOptions) {
  // prettier-ignore
  const subscriptions: RelaySubscriptionManager = runtimeSubscriptions(options.pool, options.subscriptions);
  let cached: TimelineItem[] = [],
    live: TimelineItem[] = [];
  let state: TimelineState = emptyState();
  const listeners = new Set<(state: TimelineState) => void>();
  const cleanup: (() => void)[] = [];
  const aborts = new AbortController();
  // prettier-ignore
  const relays = options.relays
    .map(normalizeRelayUrl)
    .filter((url): url is string => Boolean(url));
  let routeRelays: string[] = [],
    authors: string[] = [];
  const pageSize = options.limit ?? feedPageSize;
  let profiles: TimelineState['profiles'] = {};
  let olderScanCursor: FeedCursorPoint | undefined;
  let routeRefreshGeneration = 0,
    followListId = '',
    initialNotesKey = '';
  let followList: TimelineLoad['followList'];
  let followFallbackStarted = false;
  const followSubId = childRelaySubscriptionId(options.subId, 'follows');
  const metaSubId = childRelaySubscriptionId(options.subId, 'meta');
  const noteSubId = childRelaySubscriptionId(options.subId, 'notes');
  const profileCoordinator = createTimelineProfileCoordinator(
    relays,
    metaSubId,
  );
  const startedAt = Math.floor(Date.now() / 1000);
  let closed = false,
    generation = 0;

  // prettier-ignore
  const items = (): TimelineItem[] => mergeTimelineItems(cached, live, feedWindowSize);
  const active = (run: number): boolean => !closed && run === generation;
  // prettier-ignore
  const withCursors = (next: TimelineState): TimelineState => ({ ...next, ...boundaryCursors(next.items) });
  const nextState = (patch: Partial<TimelineState>): TimelineState =>
    withCursors({ ...state, authors, profiles, ...patch });
  // prettier-ignore
  const hydrateVisibleProfiles = async (): Promise<void> => { profileCoordinator.merge(profiles); const loaded = await profileCoordinator.hydrate(state.items); if (closed || loaded === profiles) return; profiles = loaded; emit({ ...state, profiles: loaded }); };
  // prettier-ignore
  const emit = (next: TimelineState): void => { if (closed) return; state = next; listeners.forEach((listener) => listener(state)); void hydrateVisibleProfiles(); };
  // prettier-ignore
  const applyLoaded = (loaded: TimelineLoad): void => { followList = loaded.followList; authors = loaded.authors; cached = loaded.cached; profiles = loaded.profiles; };
  // prettier-ignore
  const subscribe = (key: string, filters: readonly NostrFilter[], selectedRelays = relays): void => {
    if (closed) return;
    cleanup.push(subscriptions.subscribeLive({ key, relays: selectedRelays, filters, purpose: key === metaSubId ? 'metadata' : 'feed' }, (event) => receive(event)));
  };
  // prettier-ignore
  const loadInitialNotes = async (): Promise<void> => {
    const key = [...authors].sort().join(','); if (initialNotesKey === key || authors.length === 0) return; initialNotesKey = key;
    try {
      const page = await loadInitialTimelinePage({ authors, relays, subId: noteSubId, pageSize, subscriptions, signal: aborts.signal }); olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined;
      if (page.items.length > 0) { cached = mergeTimelineItems(page.items, items(), feedWindowSize); emit(nextState(readyWithEventsState(state, items()))); }
      else if (state.items.length === 0) emit(nextState({ loading: false, status: 'ready-empty', hasOlder: page.hasOlder }));
    } catch (error) { emit({ ...state, loading: false, error: boundedErrorText(error) }); }
  };
  // prettier-ignore
  const refreshAfterRouteDiscovery = async (run: number): Promise<void> => {
    if (routeRefreshGeneration === run || authors.length === 0) return; routeRefreshGeneration = run;
    const page = await loadInitialTimelinePage({ authors, relays, subId: `${noteSubId}:route-refresh`, pageSize, subscriptions, signal: aborts.signal }).catch(() => undefined);
    if (!page || !active(run) || page.items.length === 0) return;
    const next = mergeTimelineItems(page.items, items(), feedWindowSize);
    if (next.map((item) => item.event.id).join(',') === items().map((item) => item.event.id).join(',')) return;
    cached = next; live = []; olderScanCursor = page.hasOlder ? page.nextOlderCursor : olderScanCursor; emit(nextState(readyWithEventsState(state, items())));
  };
  // prettier-ignore
  const discoverRoutesAfterInitial = async (): Promise<void> => {
    const run = generation;
    if (closed) return;
    await discoverAuthorRelayRoutes({ authors, selectedRelays: relays, key: `${noteSubId}:routes`, subscriptions, signal: aborts.signal }).catch(() => undefined);
    if (active(run)) await refreshAfterRouteDiscovery(run);
  };
  // prettier-ignore
  const subscribeNotes = async (): Promise<void> => {
    const initialPage = loadInitialNotes();
    routeRelays = await routedAuthorRelays({ authors, selectedRelays: relays, purpose: 'write' });
    subscribe(noteSubId, authorFilters(authors, pageSize, { since: startedAt }, 'per-filter'), routeRelays);
    const missing = authors.filter((pubkey) => !profiles[pubkey]).slice(0, metadataPageLimit);
    const filters = profileFilter(missing);
    if (filters.length > 0) subscribe(metaSubId, filters);
    void initialPage.then(() => discoverRoutesAfterInitial());
  };
  // prettier-ignore
  const receiveFollowList = async (poolEvent: PoolEvent): Promise<void> => {
    if (closed) return; const event = poolEvent.event; const current = followList;
    if (followListId === event.id || (current && current.created_at > event.created_at)) { await upsertEvent(event, [poolEvent.relay]); return; }
    followList = event; followListId = event.id; authors = accountHomeAuthors(event.pubkey, event);
    await upsertEvent(event, [poolEvent.relay]);
    if (closed || followListId !== event.id) return;
    applyLoaded(await loadAccountHome(event.pubkey, event, pageSize));
    if (closed) return; emit(nextState({ items: items() })); void subscribeNotes();
  };
  // prettier-ignore
  const receiveMetadata = async (poolEvent: PoolEvent): Promise<void> => {
    if (closed || !authors.includes(poolEvent.event.pubkey)) return;
    await upsertEvent(poolEvent.event, [poolEvent.relay]); if (closed) return; const profile = await storeTimelineProfile(poolEvent.event); profiles = { ...profiles, [poolEvent.event.pubkey]: profile }; emit(nextState({ loading: false, error: null }));
  };
  // prettier-ignore
  const receive = async (poolEvent: PoolEvent): Promise<void> => {
    if (closed) return;
    if (poolEvent.subId === followSubId && poolEvent.event.kind === 3) return receiveFollowList(poolEvent);
    if (poolEvent.subId === metaSubId && poolEvent.event.kind === 0) return receiveMetadata(poolEvent);
    if (poolEvent.subId !== noteSubId || !isFeedDisplayKind(poolEvent.event.kind)) return;
    if (!authors.includes(poolEvent.event.pubkey)) return;
    await upsertEvent(poolEvent.event, [poolEvent.relay]);
    live = upsertLive(live, poolEvent.event, poolEvent.relay);
    emit(withCursors(readyWithEventsState(state, items())));
  };
  // prettier-ignore
  const handleMissingFollow = (): void => {
    if (closed) return; followFallbackStarted = true; followList = undefined; followListId = ''; authors = [options.activeAccountPubkey ?? ''].filter(Boolean);
    emit(noFollowListState(state, authors, profiles));
    void subscribeNotes();
  };
  // prettier-ignore
  const receiveState = (snapshots: RelaySnapshot[]): void => {
    if (closed) return;
    const activeRelays = selectedRelaySnapshots(snapshots, relays);
    if (needsSelfFallback(activeRelays, Boolean(followList), followFallbackStarted, followSubId)) handleMissingFollow();
    emit({ ...state, ...relayStatePatch(state, activeRelays, noteSubId) });
  };
  // prettier-ignore
  const startWithoutAccount = async (): Promise<void> => { cached = await loadCachedTimeline(pageSize).catch(() => []); if (!closed) emit(withCursors(noActiveAccountState(state, cached))); };
  // prettier-ignore
  const runtime = {
    subscribe: (listener: (state: TimelineState) => void): (() => void) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start: async (): Promise<void> => {
      if (closed) return; const run = ++generation; const pubkey = options.activeAccountPubkey; if (!pubkey) return startWithoutAccount();
      const loaded = await loadCachedAccountHome(pubkey, pageSize).catch(() => ({ authors: [pubkey], cached: [], profiles: {} }));
      if (!active(run)) return; applyLoaded(loaded);
      const next = cached.length > 0 ? readyWithEventsState(state, cached) : { ...state, items: cached };
      emit(withCursors(next)); if (relays.length === 0) return emit(noEnabledRelayState(state));
      cleanup.push(subscriptions.subscribeState(receiveState));
      if (followList) await subscribeNotes(); else subscribe(followSubId, [{ kinds: [3], authors: [pubkey], limit: 1 }]);
    },
    close: (): void => { closed = true; generation++; aborts.abort(); for (const item of cleanup.splice(0)) item(); listeners.clear(); },
    loadOlder: async (): Promise<void> => {
      if (closed || state.loadingOlder || !state.hasOlder) return; const run = generation; const cursor = olderScanCursor ?? state.oldestCursor; if (!cursor || authors.length === 0) return; emit({ ...state, loadingOlder: true });
      try { const page = await loadOlderTimelinePage({ items: items(), authors, relays, subId: noteSubId, cursor, pageSize, subscriptions, signal: aborts.signal }); if (!active(run)) return; cached = page.items; live = []; olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined; emit(nextState({ items: items(), hasOlder: page.hasOlder, hasNewer: state.hasNewer || page.hasNewer })); }
      catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingOlder) emit({ ...state, loadingOlder: false }); }
    },
    loadNewer: async (): Promise<void> => {
      if (closed || state.loadingNewer || !state.hasNewer) return; const run = generation; const cursor = state.newestCursor; if (!cursor || authors.length === 0) return; emit({ ...state, loadingNewer: true });
      try { const page = await loadNewerTimelinePage({ items: items(), authors, relays, subId: noteSubId, cursor, pageSize, subscriptions, signal: aborts.signal }); if (!active(run)) return; cached = page.items; live = []; emit(nextState({ items: items(), hasNewer: page.hasNewer, hasOlder: state.hasOlder || page.hasOlder })); }
      catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingNewer) emit({ ...state, loadingNewer: false }); }
    },
    items,
  };
  return runtime;
}
