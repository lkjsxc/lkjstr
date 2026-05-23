import type { RelayReadRequest } from './types';
import type { PoolEvent } from '../relays/relay-pool';
import type {
  ReadPageRelayStatus,
  ReadPageResult,
} from '../relays/read-page-status';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';

export async function readPageDetailedCompat(
  subscriptions: RelaySubscriptionManager,
  request: RelayReadRequest,
): Promise<ReadPageResult> {
  const detailed = subscriptions.readPageDetailed as
    | ((request: RelayReadRequest) => Promise<ReadPageResult>)
    | undefined;
  if (detailed) return detailed.call(subscriptions, request);
  const events = await subscriptions.readPage(request);
  return {
    events,
    statuses: request.relays.map((relay) =>
      incompleteFallbackStatus(relay, events),
    ),
  };
}

export function statusesComplete(
  statuses: readonly ReadPageRelayStatus[],
): boolean {
  return (
    statuses.length > 0 &&
    statuses.every(
      (status) =>
        status.eose &&
        !status.timeout &&
        !status.closed &&
        !status.auth &&
        !status.socketClosed &&
        !status.socketError,
    )
  );
}

function incompleteFallbackStatus(
  relay: string,
  events: readonly PoolEvent[],
): ReadPageRelayStatus {
  const count = events.filter((item) => item.relay === relay).length;
  return {
    relay,
    eose: false,
    timeout: false,
    closed: false,
    auth: false,
    socketClosed: false,
    socketError: false,
    durationMs: 0,
    candidateCount: count,
    finalCount: count,
  };
}
