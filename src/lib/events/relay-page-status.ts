import type { RelayReadRequest } from './types';
import type {
  ReadPageRelayStatus,
  ReadPageResult,
} from '../relays/read-page-status';
import type { RelayReadSubscriptions } from './relay-page';
import type { ReadPageOptions } from '../relays/subscription-manager-types';

export async function readPageDetailedCompat(
  subscriptions: RelayReadSubscriptions,
  request: RelayReadRequest,
  options: ReadPageOptions = {},
): Promise<ReadPageResult> {
  const detailed = subscriptions.readPageDetailed as
    | ((
        request: RelayReadRequest,
        options?: ReadPageOptions,
      ) => Promise<ReadPageResult>)
    | undefined;
  if (detailed) return detailed.call(subscriptions, request, options);
  const events = await subscriptions.readPage(request, options);
  return { events, statuses: [] };
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
        !status.socketError &&
        !status.eventLimitReached,
    )
  );
}
