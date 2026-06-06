import type { NostrEvent } from '$lib/protocol';
import type { FolloweeEntry } from '$lib/profile/followees';

export type TargetFollowListStateName =
  | 'idle'
  | 'cache_hit'
  | 'reading_selected'
  | 'reading_author_routes'
  | 'reading_receipt_routes'
  | 'reading_provenance_routes'
  | 'reading_discovery'
  | 'found'
  | 'empty_follow_list'
  | 'not_found_proven'
  | 'partial_failure'
  | 'all_failed'
  | 'aborted';

export type TargetFollowRouteGroup = {
  readonly key: string;
  readonly label: string;
  readonly relays: readonly string[];
};

export type TargetFollowListDiagnostics = {
  readonly attemptedRelays: readonly string[];
  readonly failedRelays: readonly string[];
  readonly relayUrls: readonly string[];
  readonly attemptedRouteGroups: readonly string[];
  readonly failedRouteGroups: readonly string[];
  readonly pendingRouteGroups: readonly string[];
  readonly reasonCodes: readonly string[];
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
  | 'provenance_routes'
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
  attemptedRouteGroups: [],
  failedRouteGroups: [],
  pendingRouteGroups: [],
  reasonCodes: [],
  partialFailure: false,
  provenAbsent: false,
  source,
});

export function targetFollowListMessage(
  state: TargetFollowListStateName,
  diagnostics: TargetFollowListDiagnostics = emptyFollowListDiagnostics(),
): string {
  if (state === 'cache_hit')
    return 'Showing cached follow list while relays refresh.';
  if (state.startsWith('reading_')) return readingMessage(state, diagnostics);
  if (state === 'found') return 'Public follow list found.';
  if (state === 'empty_follow_list') return 'Follow list has no valid pubkeys.';
  if (state === 'not_found_proven')
    return 'No public follow list was found on completed relay routes.';
  if (state === 'partial_failure') return incompleteMessage(diagnostics);
  if (state === 'all_failed') return failedMessage(diagnostics);
  if (state === 'aborted') return 'Follow-list discovery was cancelled.';
  return '';
}

function readingMessage(
  state: TargetFollowListStateName,
  diagnostics: TargetFollowListDiagnostics,
): string {
  const label = state.replace('reading_', '').replaceAll('_', ' ');
  const attempted = diagnostics.attemptedRouteGroups.length;
  return attempted > 0
    ? `Discovering public follow list through ${label}; ${attempted} route group(s) tried.`
    : `Discovering public follow list through ${label}...`;
}

function incompleteMessage(diagnostics: TargetFollowListDiagnostics): string {
  const tried =
    diagnostics.attemptedRouteGroups.join(', ') || 'configured routes';
  const failed = diagnostics.failedRelays.length;
  const suffix = failed > 0 ? ` ${failed} relay(s) failed or timed out.` : '';
  return `Follow-list discovery incomplete after ${tried}.${suffix} Retry or add target relays.`;
}

function failedMessage(diagnostics: TargetFollowListDiagnostics): string {
  const failed = diagnostics.failedRelays.length;
  return failed > 0
    ? `Follow-list relay reads failed on ${failed} relay(s); retry or inspect relay diagnostics.`
    : 'Follow-list relay reads failed; retry or inspect relay diagnostics.';
}
