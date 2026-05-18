import type { RelaySnapshot } from '../relays/types';
import {
  errorFor,
  missingFollowAfterEose,
  relaySnapshotCounts,
  statusFromRelayState,
  type TimelineState,
} from './timeline-state';

export function selectedRelaySnapshots(
  snapshots: readonly RelaySnapshot[],
  relays: readonly string[],
): RelaySnapshot[] {
  return snapshots.filter((item) => relays.includes(item.url));
}

export function needsSelfFallback(
  active: readonly RelaySnapshot[],
  followListFound: boolean,
  fallbackStarted: boolean,
  followSubId: string,
): boolean {
  return missingFollowAfterEose(
    active,
    followListFound,
    fallbackStarted,
    followSubId,
  );
}

export function relayStatePatch(
  state: TimelineState,
  active: readonly RelaySnapshot[],
  noteSubId: string,
): Partial<TimelineState> {
  const diagnostics = active.flatMap((item) => item.diagnostics);
  const status = statusFromRelayState(
    active,
    diagnostics,
    state.items.length > 0,
    state.status === 'no-follow-list',
    noteSubId,
  );
  return {
    loading: status === 'loading-follows',
    ...relaySnapshotCounts(active, noteSubId),
    diagnostics,
    status,
    error: errorFor(status),
  };
}
