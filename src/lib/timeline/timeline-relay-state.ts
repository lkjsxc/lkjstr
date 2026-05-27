import type { RelaySnapshot } from '../relays/types';
import {
  errorFor,
  missingFollowAfterEose,
  type TimelineState,
} from './timeline-state';
import {
  relaySnapshotCounts,
  statusFromRelayState,
} from './timeline-relay-eose';
import { subscriptionEose } from './timeline-relay-eose';

export function selectedRelaySnapshots(
  snapshots: readonly RelaySnapshot[],
  relays: readonly string[],
): RelaySnapshot[] {
  return snapshots.filter((item) => relays.includes(item.url));
}

export function followDiscoveryFinishedWithoutList(
  active: readonly RelaySnapshot[],
  followListFound: boolean,
  fallbackStarted: boolean,
  followSubId: string,
): boolean {
  // Missing follow-list state is finalized only when the follow-list
  // subscription itself is complete (or terminal) on every selected relay.
  // Unrelated EOSE markers must not trigger fallback.
  return (
    missingFollowAfterEose(
      active,
      followListFound,
      fallbackStarted,
      followSubId,
    ) &&
    active.every(
      (item) =>
        subscriptionEose(item, followSubId) ||
        item.closedBySub[followSubId] ||
        // Keep the intent explicit even if relay snapshot uses closed/error.
        item.state === 'error' ||
        item.state === 'closed',
    )
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
