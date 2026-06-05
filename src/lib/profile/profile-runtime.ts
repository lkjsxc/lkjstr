import { feedPageSize, oldestCreatedAt } from '$lib/events/feed-window';
import { boundedErrorText } from '$lib/events/runtime-error';
import {
  getProfile,
  profileFromMetadataEvent,
} from '$lib/identity/profile-cache';
import type { RelayPool } from '$lib/relays/relay-pool';
import type { DemandVisibility } from '$lib/relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { runtimeSubscriptions } from '$lib/relays/runtime-subscriptions';
import {
  cachedProfileEvent,
  cachedProfileFollowList,
  cachedProfileNotes,
} from './profile-store';
import { submitProfilePostsLiveIntent } from './profile-route-plans';
import { createProfileRuntimeHandlers } from './profile-runtime-handlers';
import { loadInitialProfilePage } from './profile-runtime-initial';
import { createProfilePageLoaders } from './profile-runtime-loaders';
import { continueSparseProfileScan } from './profile-runtime-sparse';
import { profileFollowListStatus } from './follow-count-state';
import { emptyProfileState, type ProfileState } from './profile-state';
import { withProfileCursors } from './profile-runtime-display';
import type { ProfileOlderPreserveMode } from './profile-runtime-paging';
import type { FeedCursorPoint } from '$lib/events/types';

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
  const handlers = createProfileRuntimeHandlers({
    pubkey,
    startedAt,
    isClosed: () => closed,
    getState: () => state,
    emit,
  });
  const loaders = createProfilePageLoaders({
    pubkey,
    relays,
    owner,
    pageSize,
    subscriptions: manager,
    signal: aborts.signal,
    isClosed: () => closed,
    active,
    generation: () => generation,
    getState: () => state,
    emit,
    getOlderCursor: () => olderScanCursor,
    setOlderCursor: (cursor) => (olderScanCursor = cursor),
    getNewerCursor: () => newerScanCursor,
    setNewerCursor: (cursor) => (newerScanCursor = cursor),
  });

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
      olderScanCursor = page.nextOlderCursor;
      emit({
        ...state,
        profile: page.profile,
        followList: page.followList,
        followListStatus: page.followList
          ? profileFollowListStatus(page.followList)
          : 'incomplete',
        posts: page.posts,
        hasOlder: page.hasOlder,
        loading: false,
        relays: [...new Set([...state.relays, ...page.relays])],
      });
      if (page.posts.length === 0 && page.hasOlder)
        void continueSparseProfileScan({
          active: () => active(run),
          getState: () => state,
          loadOlder: () => loaders.loadOlder(),
        });
    } catch (error) {
      emit({
        ...state,
        loading: false,
        followListStatus: state.followList ? state.followListStatus : 'failed',
        error: boundedErrorText(error),
      });
    }
  };
  const runtime = {
    subscribe: (listener: (state: ProfileState) => void): (() => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    start: async (): Promise<void> => {
      if (closed) return;
      const run = ++generation;
      const [meta, posts, followList] = await Promise.all([
        cachedProfileEvent(pubkey),
        cachedProfileNotes(pubkey, pageSize),
        cachedProfileFollowList(pubkey),
      ]);
      if (!active(run)) return;
      const profile =
        getProfile(pubkey) ?? (meta ? profileFromMetadataEvent(meta) : null);
      emit({
        ...state,
        profile,
        posts,
        followList,
        followListStatus: followList
          ? profileFollowListStatus(followList)
          : relays.length > 0
            ? 'discovering-relays'
            : 'unavailable',
        loading: relays.length > 0,
        updatedAt: meta ? meta.created_at * 1000 : null,
        oldestCreatedAt: oldestCreatedAt(posts),
      });
      if (relays.length === 0) {
        emit({ ...state, loading: false, followListStatus: 'unavailable' });
        return;
      }
      cleanup.push(
        await submitProfilePostsLiveIntent({
          pubkey,
          relays,
          owner,
          pageSize,
          startedAt,
          visibility,
          subscriptions: manager,
          onEvent: (event) => void handlers.receive(event),
        }),
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
    loadOlder: async (
      options: { preserve?: ProfileOlderPreserveMode } = {},
    ): Promise<void> => {
      await loaders.loadOlder(options);
    },
    loadNewer: async (): Promise<void> => {
      await loaders.loadNewer();
    },
  };
  return runtime;
}
