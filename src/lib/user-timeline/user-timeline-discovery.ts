import type { TargetFollowListSnapshot } from '$lib/follow-graph/target-follow-list-state';
import {
  degradedNotice,
  type UserTimelineDiscovery,
} from './user-timeline-state';

const outcomeCounts = new Map<string, number>();
const reasonCounts = new Map<string, number>();

export function discoveryFromFollow(
  snapshot: TargetFollowListSnapshot,
  hasTargetPosts: boolean,
): UserTimelineDiscovery {
  const found = Boolean(snapshot.followList);
  return {
    state: userTimelineDiscoveryState(snapshot, hasTargetPosts),
    attemptedRouteGroups: snapshot.attemptedRouteGroups,
    successfulRouteGroups: found
      ? [snapshot.source].filter((item) => item !== 'cache')
      : [],
    failedRouteGroups: snapshot.failedRouteGroups,
    pendingRouteGroups: snapshot.pendingRouteGroups,
    followListEventId: snapshot.followList?.id,
    newestFollowListCreatedAt: snapshot.followList?.created_at,
    reasonCodes: snapshot.reasonCodes,
    canRetry: !found && snapshot.state !== 'aborted',
  };
}

export function userTimelineNotice(
  snapshot: TargetFollowListSnapshot,
  hasTargetPosts: boolean,
): string {
  const routes = compactRouteText(snapshot);
  if (hasTargetPosts && !snapshot.followList)
    return `${degradedNotice}${routes}`;
  return `${snapshot.message || degradedNotice}${routes}`;
}

export function recordUserTimelineDiscoveryOutcome(
  discovery: UserTimelineDiscovery,
): void {
  increment(outcomeCounts, discovery.state);
  for (const reason of discovery.reasonCodes) increment(reasonCounts, reason);
}

export function userTimelineDiscoveryDiagnostics(): {
  readonly outcomes: readonly {
    readonly key: string;
    readonly count: number;
  }[];
  readonly reasons: readonly { readonly key: string; readonly count: number }[];
} {
  return {
    outcomes: entries(outcomeCounts),
    reasons: entries(reasonCounts),
  };
}

function userTimelineDiscoveryState(
  snapshot: TargetFollowListSnapshot,
  hasTargetPosts: boolean,
): UserTimelineDiscovery['state'] {
  if (snapshot.followList) return 'partial';
  if (snapshot.state === 'reading_selected') return 'loading-selected-relays';
  if (snapshot.state === 'reading_author_routes') return 'loading-nip65-routes';
  if (snapshot.state === 'reading_receipt_routes')
    return 'loading-target-routes';
  if (snapshot.state === 'reading_provenance_routes')
    return 'loading-provenance-routes';
  if (snapshot.state === 'partial_failure')
    return hasTargetPosts ? 'target-posts-only' : 'incomplete';
  if (snapshot.state === 'all_failed') return 'failed';
  if (snapshot.state === 'not_found_proven')
    return hasTargetPosts ? 'target-posts-only' : 'incomplete';
  return 'loading-cache';
}

function compactRouteText(snapshot: TargetFollowListSnapshot): string {
  if (snapshot.attemptedRouteGroups.length === 0) return '';
  const failed = snapshot.failedRouteGroups.length;
  return failed > 0
    ? ` Tried ${snapshot.attemptedRouteGroups.join(', ')}; ${failed} group(s) failed.`
    : ` Tried ${snapshot.attemptedRouteGroups.join(', ')}.`;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function entries(map: Map<string, number>) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
