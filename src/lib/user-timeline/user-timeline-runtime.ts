import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { runTargetFollowListRuntime } from '$lib/follow-graph/target-follow-list-runtime';
import type { TargetFollowListSnapshot } from '$lib/follow-graph/target-follow-list-state';
import { feedPageSize } from '$lib/events/feed-window';
import {
  feedEventsFromProgressiveSnapshot,
  progressiveStatusText,
} from '$lib/timeline/timeline-progressive';
import type { TimelineItem } from '$lib/timeline/timeline-store';
import {
  mergeUserTimelineItems,
  loadCachedUserTimeline,
} from './user-timeline-cache';
import { userTimelineCachePolicy } from './user-timeline-cache-policy';
import { readInitialUserTimeline } from './user-timeline-loaders';
import {
  targetPostsOnlyAuthorSet,
  userTimelineAuthorSet,
  type UserTimelineAuthorSet,
} from './user-timeline-authors';
import {
  pendingTargetPostNotice,
  userTimelineInitialSnapshot,
  type UserTimelineSnapshot,
} from './user-timeline-state';
import {
  discoveryFromFollow,
  recordUserTimelineDiscoveryOutcome,
  userTimelineNotice,
} from './user-timeline-discovery';

export type UserTimelineRuntimeInput = {
  readonly targetPubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly onSnapshot: (snapshot: UserTimelineSnapshot) => void;
  readonly runFollowList?: typeof runTargetFollowListRuntime;
  readonly readInitial?: typeof readInitialUserTimeline;
  readonly loadCached?: typeof loadCachedUserTimeline;
};

export async function runUserTimelineRuntime(
  input: UserTimelineRuntimeInput,
): Promise<UserTimelineSnapshot> {
  const runFollowList = input.runFollowList ?? runTargetFollowListRuntime;
  const readInitial = input.readInitial ?? readInitialUserTimeline;
  const loadCached = input.loadCached ?? loadCachedUserTimeline;
  let state = userTimelineInitialSnapshot();
  let planKey = '';
  const emit = (patch: Partial<UserTimelineSnapshot>) => {
    state = { ...state, ...patch };
    input.onSnapshot(state);
  };
  emit({ discovery: { ...state.discovery, state: 'loading-cache' } });
  const targetPosts = loadAuthors(
    targetPostsOnlyAuthorSet(input.targetPubkey),
    pendingTargetPostNotice,
  );
  const follow = await runFollowList({
    targetPubkey: input.targetPubkey,
    selectedReadRelays: input.relays,
    owner: input.owner,
    surface: 'user-timeline',
    subscriptions: input.subscriptions,
    signal: input.signal,
    allowDiscoveryFallback: true,
    onSnapshot: (snapshot) => void handleFollowSnapshot(snapshot),
  });
  if (follow.followList && !input.signal.aborted) {
    await handleFollowSnapshot(follow);
    recordUserTimelineDiscoveryOutcome(discoveryFromFollow(follow, false));
  } else if (!input.signal.aborted) {
    await targetPosts.catch(() => undefined);
    const hasTargetPosts = state.items.length > 0;
    const discovery = discoveryFromFollow(follow, hasTargetPosts);
    recordUserTimelineDiscoveryOutcome(discovery);
    emit({
      discovery,
      notice: userTimelineNotice(follow, hasTargetPosts),
      loading: false,
    });
  }
  return state;

  async function handleFollowSnapshot(
    snapshot: TargetFollowListSnapshot,
  ): Promise<void> {
    emit({ discovery: discoveryFromFollow(snapshot, state.items.length > 0) });
    if (snapshot.followList) {
      await loadAuthors(
        userTimelineAuthorSet({
          targetPubkey: input.targetPubkey,
          followList: snapshot.followList,
        }),
        snapshot.entries.length === 0
          ? 'Follow list has no valid authors beyond the target pubkey.'
          : '',
      );
      return;
    }
    if (snapshot.state.startsWith('reading_'))
      emit({ notice: snapshot.message, loading: state.items.length === 0 });
  }

  async function loadAuthors(
    set: UserTimelineAuthorSet,
    notice: string,
  ): Promise<void> {
    const nextKey = `${set.mode}:${set.hash}`;
    if (planKey === nextKey || input.signal.aborted) return;
    planKey = nextKey;
    const cached = await loadCached({
      authors: set.authors,
      limit: feedPageSize,
    }).catch(() => [] as TimelineItem[]);
    if (planKey !== nextKey || input.signal.aborted) return;
    const cachePolicy = userTimelineCachePolicy({
      items: cached,
      coverageProven: false,
      authorSetMatches: true,
    });
    emit({
      mode: set.mode,
      items: cachePolicy.items,
      authors: set.authors,
      loading: true,
      notice: notice || cachePolicy.notice,
      error: null,
    });
    try {
      const page = await readInitial({
        authors: set.authors,
        relays: input.relays,
        owner: input.owner,
        subscriptions: input.subscriptions,
        signal: input.signal,
        onSnapshot: (snapshot) => {
          if (planKey !== nextKey) return;
          emit({
            items: mergeUserTimelineItems({
              current: state.items,
              incoming: feedEventsFromProgressiveSnapshot(snapshot),
              limit: feedPageSize,
            }),
            relayStatusText: progressiveStatusText(snapshot.status),
          });
        },
      });
      if (planKey !== nextKey || input.signal.aborted) return;
      emit({
        items: mergeUserTimelineItems({
          current: state.items,
          incoming: page.items,
          limit: feedPageSize,
        }),
        hasOlder: page.hasOlder,
        nextOlderCursor: page.nextOlderCursor,
        loading: false,
        relayStatusText: '',
      });
    } catch (err) {
      if (planKey === nextKey && !input.signal.aborted)
        emit({ error: errorMessage(err), loading: false });
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'User Timeline read failed.';
}
