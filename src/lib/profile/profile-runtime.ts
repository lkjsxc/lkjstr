import { feedPageSize, oldestCreatedAt } from '$lib/events/feed-window';
import { boundedErrorText } from '$lib/events/runtime-error';
import { isFeedDisplayKind } from '$lib/events/feed-kinds';
import {
  getProfile,
  profileFromMetadataEvent,
} from '$lib/identity/profile-cache';
import type { NostrEvent } from '$lib/protocol';
import type { FeedCursorPoint } from '$lib/events/types';
import type { PoolEvent, RelayPool } from '$lib/relays/relay-pool';
import type { DemandVisibility } from '$lib/relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { runtimeSubscriptions } from '$lib/relays/runtime-subscriptions';
import {
  cachedProfileEvent,
  cachedProfileFollowList,
  cachedProfileNotes,
  storeProfileEvent,
} from './profile-store';
import { loadInitialProfilePage } from './profile-runtime-initial';
import {
  loadNewerProfilePage,
  loadOlderProfilePage,
} from './profile-runtime-paging';
import { emptyProfileState, type ProfileState } from './profile-state';
import { profileLiveFilters } from './profile-subscription-filters';
import {
  mergeProfileLivePost,
  shouldDisplayLiveProfilePost,
  withProfileCursors,
} from './profile-runtime-display';
import type { ProfileOlderPreserveMode } from './profile-runtime-paging';

export type { ProfileState } from './profile-state';
export type ProfileRuntime = ReturnType<typeof createProfileRuntime>;

export function createProfileRuntime(
  pubkey: string,
  relays: readonly string[],
  subId = `profile:${crypto.randomUUID()}`,
  owner = subId,
  pool?: RelayPool,
  subscriptions?: SubscriptionOrchestrator,
) {
  const manager = runtimeSubscriptions(pool, subscriptions);
  let visibility: DemandVisibility = 'visible';
  const cleanup: (() => void)[] = [];
  const aborts = new AbortController();
  const listeners = new Set<(state: ProfileState) => void>();
  const pageSize = feedPageSize;
  const startedAt = Math.floor(Date.now() / 1000);
  let state: ProfileState = emptyProfileState();
  let olderScanCursor: FeedCursorPoint | undefined;
  let newerScanCursor: FeedCursorPoint | undefined;
  let closed = false;
  let generation = 0;

  const active = (run: number): boolean => !closed && generation === run;
  const emit = (next: ProfileState): void => {
    if (closed) return;
    state = withProfileCursors(next);
    listeners.forEach((listener) => listener(state));
  };
  const receiveFollowList = (event: NostrEvent): void => {
    const current = state.followList;
    if (current && current.created_at > event.created_at) return;
    if (current?.id === event.id) return;
    emit({ ...state, followList: event, loading: false });
  };
  const receiveMeta = (poolEvent: PoolEvent): void => {
    if (poolEvent.event.pubkey !== pubkey) return;
    const updatedAt = poolEvent.event.created_at * 1000;
    if (state.updatedAt && state.updatedAt > updatedAt) return;
    const profile =
      getProfile(pubkey) ?? profileFromMetadataEvent(poolEvent.event);
    if (profile.updatedAt > updatedAt) return;
    emit({
      ...state,
      profile,
      loading: false,
      relays: [...new Set([...state.relays, poolEvent.relay])],
      updatedAt: profile.updatedAt,
    });
  };
  const receivePost = (event: NostrEvent, relay: string): void => {
    if (closed) return;
    const display = shouldDisplayLiveProfilePost({ event, state, startedAt });
    if (display === 'hidden') return;
    if (display === 'has-newer') {
      emit({ ...state, loading: false, hasNewer: true });
      return;
    }
    const item = { event, relays: [relay] };
    const window = mergeProfileLivePost(state.posts, item);
    emit({
      ...state,
      posts: window.items,
      loading: false,
      hasOlder: state.hasOlder || window.prunedOlder,
    });
  };
  // prettier-ignore
  const receive = async (poolEvent: PoolEvent): Promise<void> => {
    if (closed || poolEvent.event.pubkey !== pubkey) return;
    await storeProfileEvent(poolEvent.event, [poolEvent.relay]);
    if (closed) return;
    if (poolEvent.event.kind === 0) receiveMeta(poolEvent);
    if (poolEvent.event.kind === 3) receiveFollowList(poolEvent.event);
    if (isFeedDisplayKind(poolEvent.event.kind))
      receivePost(poolEvent.event, poolEvent.relay);
  };
  // prettier-ignore
  const loadInitialPage = async (): Promise<void> => {
    const run = generation;
    try {
      const page = await loadInitialProfilePage({
        posts: state.posts,
        profile: state.profile,
        followList: state.followList,
        relays,
        pubkey,
        owner,
        pageSize,
        subscriptions: manager,
        signal: aborts.signal,
      });
      if (!active(run)) return;
      emit({ ...state, profile: page.profile, followList: page.followList, posts: page.posts, loading: false, relays: [...new Set([...state.relays, ...page.relays])] });
    } catch (error) {
      emit({ ...state, loading: false, error: boundedErrorText(error) });
    }
  };
  // prettier-ignore
  const runtime = {
    subscribe: (listener: (state: ProfileState) => void): (() => void) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start: async (): Promise<void> => {
      if (closed) return; const run = ++generation;
      const [meta, posts, followList] = await Promise.all([cachedProfileEvent(pubkey), cachedProfileNotes(pubkey, pageSize), cachedProfileFollowList(pubkey)]);
      if (!active(run)) return; const profile = getProfile(pubkey) ?? (meta ? profileFromMetadataEvent(meta) : null);
      emit({ ...state, profile, posts, followList, loading: relays.length > 0, updatedAt: meta ? meta.created_at * 1000 : null, oldestCreatedAt: oldestCreatedAt(posts) });
      if (relays.length === 0) {
        emit({ ...state, loading: false });
        return;
      }
      cleanup.push(
        manager.submitLiveIntent(
          {
            surface: 'profile',
            owner,
            channel: 'profile:posts',
            visibility,
            selectedRelays: relays,
            filters: profileLiveFilters(pubkey, startedAt, pageSize),
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
      if (visible) manager.resumeOwner(owner);
      else manager.pauseOwner(owner);
    },
    close: (): void => {
      closed = true;
      generation++;
      aborts.abort();
      manager.releaseOwner(owner);
      for (const item of cleanup.splice(0)) item();
      listeners.clear();
    },
    loadOlder: async (options: { preserve?: ProfileOlderPreserveMode } = {}): Promise<void> => {
      if (closed || state.loadingOlder || !state.hasOlder) return; const run = generation; const cursor = olderScanCursor ?? state.oldestCursor; if (!cursor) return; emit({ ...state, loadingOlder: true });
      try {
        const page = await loadOlderProfilePage({ posts: state.posts, pubkey, relays, owner, cursor, pageSize, subscriptions: manager, signal: aborts.signal, preserve: options.preserve });
        if (!active(run)) return;
        const { feedRowShells } = await import('../feed-surface/row-shell');
        emit({ ...state, posts: feedRowShells(page.posts), hasOlder: page.hasOlder, loadingOlder: true });
        olderScanCursor = page.hasOlder ? page.nextOlderCursor : undefined;
        emit({ ...state, posts: page.posts, hasOlder: page.hasOlder, hasNewer: state.hasNewer || page.newerPruned, newerPruned: state.newerPruned || page.newerPruned });
      }
      catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingOlder) emit({ ...state, loadingOlder: false }); }
    },
    loadNewer: async (): Promise<void> => {
      if (closed || state.loadingNewer || !state.hasNewer) return; const run = generation; const cursor = newerScanCursor ?? state.newestCursor; if (!cursor) return; emit({ ...state, loadingNewer: true });
      try { const page = await loadNewerProfilePage({ posts: state.posts, pubkey, relays, owner, cursor, pageSize, subscriptions: manager, signal: aborts.signal }); if (!active(run)) return; newerScanCursor = page.hasNewer ? page.nextNewerCursor : undefined; emit({ ...state, posts: page.posts, hasNewer: page.hasNewer, hasOlder: state.hasOlder || page.olderPruned, newerPruned: page.hasNewer }); }
      catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingNewer) emit({ ...state, loadingNewer: false }); }
    },
  };
  return runtime;
}
