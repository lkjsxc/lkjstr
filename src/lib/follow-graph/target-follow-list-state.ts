import type { NostrEvent } from '$lib/protocol';
import type { FolloweeEntry } from '$lib/profile/followees';

export type TargetFollowListStateName =
  | 'idle'
  | 'cache_hit'
  | 'reading_selected'
  | 'reading_author_routes'
  | 'reading_receipt_routes'
  | 'reading_discovery'
  | 'found'
  | 'empty_follow_list'
  | 'not_found_proven'
  | 'partial_failure'
  | 'all_failed'
  | 'aborted';

export type TargetFollowListDiagnostics = {
  readonly attemptedRelays: readonly string[];
  readonly failedRelays: readonly string[];
  readonly relayUrls: readonly string[];
  readonly partialFailure: boolean;
  readonly provenAbsent: boolean;
  readonly source: TargetFollowListSource;
};

export type TargetFollowListSource =
  | 'none'
  | 'cache'
  | 'selected'
  | 'author_routes'
  | 'receipt_routes'
  | 'discovery';

export type TargetFollowListSnapshot = TargetFollowListDiagnostics & {
  readonly state: TargetFollowListStateName;
  readonly targetPubkey: string;
  readonly followList?: NostrEvent;
  readonly entries: readonly FolloweeEntry[];
  readonly followingCount: number;
  readonly message: string;
};

export const emptyFollowListDiagnostics = (
  source: TargetFollowListSource = 'none',
): TargetFollowListDiagnostics => ({
  attemptedRelays: [],
  failedRelays: [],
  relayUrls: [],
  partialFailure: false,
  provenAbsent: false,
  source,
});

export function targetFollowListMessage(
  state: TargetFollowListStateName,
): string {
  if (state === 'cache_hit') return 'Showing cached follow list.';
  if (state.startsWith('reading_')) return 'Discovering public follow list...';
  if (state === 'found') return 'Public follow list found.';
  if (state === 'empty_follow_list') return 'Follow list has no valid pubkeys.';
  if (state === 'not_found_proven')
    return 'No public follow list was found on attempted relays.';
  if (state === 'partial_failure')
    return 'Follow-list discovery is incomplete.';
  if (state === 'all_failed') return 'Follow-list relay reads failed.';
  if (state === 'aborted') return 'Follow-list discovery was cancelled.';
  return '';
}
