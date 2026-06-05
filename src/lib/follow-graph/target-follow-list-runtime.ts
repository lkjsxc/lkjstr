import type { NostrEvent } from '$lib/protocol';
import { followeeEntries, type FolloweeEntry } from '$lib/profile/followees';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import {
  emptyFollowListDiagnostics,
  targetFollowListMessage,
  type TargetFollowListSnapshot,
  type TargetFollowListStateName,
} from './target-follow-list-state';
import {
  loadCachedTargetFollowList,
  newestFollowList,
  storeTargetFollowList,
} from './target-follow-list-cache';
import { readTargetFollowList } from './target-follow-list-read';

export type TargetFollowListRuntimeInput = {
  readonly targetPubkey: string;
  readonly selectedReadRelays: readonly string[];
  readonly owner: string;
  readonly surface: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly allowDiscoveryFallback?: boolean;
  readonly seedEventId?: string;
  readonly onSnapshot?: (snapshot: TargetFollowListSnapshot) => void;
  readonly loadCached?: typeof loadCachedTargetFollowList;
  readonly storeFound?: typeof storeTargetFollowList;
  readonly readRelay?: typeof readTargetFollowList;
};

export async function runTargetFollowListRuntime(
  input: TargetFollowListRuntimeInput,
): Promise<TargetFollowListSnapshot> {
  const loadCached = input.loadCached ?? loadCachedTargetFollowList;
  const storeFound = input.storeFound ?? storeTargetFollowList;
  const readRelay = input.readRelay ?? readTargetFollowList;
  const cached = await loadCached(input.targetPubkey, input.seedEventId);
  let current = cached;
  if (cached) emit(input, snapshot(input.targetPubkey, 'cache_hit', cached));
  const result = await readRelay({
    targetPubkey: input.targetPubkey,
    selectedRelays: input.selectedReadRelays,
    subscriptions: input.subscriptions,
    signal: input.signal,
    key: `${input.owner}:${input.surface}:follow-list`,
    allowDiscoveryFallback: input.allowDiscoveryFallback,
    onPhase: (phase) =>
      emit(input, snapshot(input.targetPubkey, readingState(phase), current)),
  });
  if (result.type === 'aborted')
    return finish(input, snapshot(input.targetPubkey, 'aborted', current));
  if (result.type === 'found') {
    current = newestFollowList(current, result.followList);
    if (current?.id === result.followList.id)
      await storeFound(result.followList, result.relayUrls);
    const state = entriesFor(current).length === 0 ? 'empty_follow_list' : 'found';
    return finish(
      input,
      snapshot(input.targetPubkey, state, current, {
        attemptedRelays: result.attemptedRelays,
        failedRelays: result.failedRelays,
        relayUrls: result.relayUrls,
        partialFailure: result.failedRelays.length > 0,
        provenAbsent: false,
        source: result.source,
      }),
    );
  }
  if (current) {
    const state = result.type === 'partialFailure' ? 'partial_failure' : 'cache_hit';
    return finish(
      input,
      snapshot(input.targetPubkey, state, current, {
        attemptedRelays: result.attemptedRelays,
        failedRelays: result.failedRelays,
        relayUrls: [],
        partialFailure: result.type !== 'notFound',
        provenAbsent: result.type === 'notFound',
        source: 'cache',
      }),
    );
  }
  return finish(input, snapshot(input.targetPubkey, stateFromRead(result.type), undefined, {
    attemptedRelays: result.attemptedRelays,
    failedRelays: result.failedRelays,
    relayUrls: [],
    partialFailure: result.type === 'partialFailure',
    provenAbsent: result.type === 'notFound',
    source: 'none',
  }));
}

function snapshot(
  targetPubkey: string,
  state: TargetFollowListStateName,
  followList?: NostrEvent,
  diagnostics = emptyFollowListDiagnostics(followList ? 'cache' : 'none'),
): TargetFollowListSnapshot {
  const entries = entriesFor(followList);
  return {
    state,
    targetPubkey,
    followList,
    entries,
    followingCount: entries.length,
    message: targetFollowListMessage(state),
    ...diagnostics,
  };
}

function entriesFor(followList?: NostrEvent): FolloweeEntry[] {
  return followeeEntries(followList);
}

function readingState(
  phase: 'selected' | 'author_routes' | 'receipt_routes' | 'discovery',
): TargetFollowListStateName {
  return `reading_${phase}`;
}

function stateFromRead(
  type: 'notFound' | 'partialFailure' | 'allFailed',
): TargetFollowListStateName {
  if (type === 'notFound') return 'not_found_proven';
  if (type === 'partialFailure') return 'partial_failure';
  return 'all_failed';
}

function emit(
  input: TargetFollowListRuntimeInput,
  value: TargetFollowListSnapshot,
): void {
  input.onSnapshot?.(value);
}

function finish(
  input: TargetFollowListRuntimeInput,
  value: TargetFollowListSnapshot,
): TargetFollowListSnapshot {
  emit(input, value);
  return value;
}
