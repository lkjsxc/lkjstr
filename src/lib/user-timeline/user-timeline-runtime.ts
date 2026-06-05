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
import { readInitialUserTimeline } from './user-timeline-loaders';
import {
  targetPostsOnlyAuthorSet,
  userTimelineAuthorSet,
  type UserTimelineAuthorSet,
} from './user-timeline-authors';
import {
  degradedNotice,
  userTimelineInitialSnapshot,
  type UserTimelineSnapshot,
} from './user-timeline-state';

export type UserTimelineRuntimeInput = {
  readonly targetPubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly onSnapshot: (snapshot: UserTimelineSnapshot) => void;
};

export async function runUserTimelineRuntime(
  input: UserTimelineRuntimeInput,
): Promise<UserTimelineSnapshot> {
  let state = userTimelineInitialSnapshot();
  let planKey = '';
  const emit = (patch: Partial<UserTimelineSnapshot>) => {
    state = { ...state, ...patch };
    input.onSnapshot(state);
  };
  emit({});
  void loadAuthors(targetPostsOnlyAuthorSet(input.targetPubkey), degradedNotice);
  const follow = await runTargetFollowListRuntime({
    targetPubkey: input.targetPubkey,
    selectedReadRelays: input.relays,
    owner: input.owner,
    surface: 'user-timeline',
    subscriptions: input.subscriptions,
    signal: input.signal,
    allowDiscoveryFallback: true,
    onSnapshot: (snapshot) => void handleFollowSnapshot(snapshot),
  });
  if (!follow.followList && !input.signal.aborted)
    emit({ notice: follow.message || degradedNotice, loading: false });
  return state;

  async function handleFollowSnapshot(
    snapshot: TargetFollowListSnapshot,
  ): Promise<void> {
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
    const cached = await loadCachedUserTimeline({
      authors: set.authors,
      limit: feedPageSize,
    }).catch(() => [] as TimelineItem[]);
    if (planKey !== nextKey || input.signal.aborted) return;
    emit({
      mode: set.mode,
      items: cached,
      authors: set.authors,
      loading: true,
      notice,
      error: null,
    });
    try {
      const page = await readInitialUserTimeline({
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
          current: cached,
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
