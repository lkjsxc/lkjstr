import type { NostrFilter } from '../protocol';
import type { ReadPageRelayStatus } from '../relays/read-page-status';
import { appendAppLog } from '../log/app-log';
import { saveFeedCoverage } from './feed-coverage-store';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedCoverageStatus } from './types';

export async function recordScanCoverage(
  request: RelayGroupPageRequest,
  groupKey: string,
  relays: readonly string[],
  filters: readonly NostrFilter[],
  status: FeedCoverageStatus,
): Promise<void> {
  await Promise.all(
    relays.flatMap((relayUrl) =>
      filters.map((filter) =>
        saveFeedCoverage({
          feedKey: request.key,
          relayUrl,
          groupKey,
          filterKey: JSON.stringify({
            kinds: filter.kinds,
            authors: filter.authors,
            limit: filter.limit,
          }),
          status,
          since: filter.since,
          until: filter.until,
        }),
      ),
    ),
  );
}

export function logIncompleteScan(
  request: RelayGroupPageRequest,
  groupKey: string,
  bounds: Pick<NostrFilter, 'since' | 'until'>,
  statuses: readonly ReadPageRelayStatus[],
): void {
  appendAppLog({
    area: 'relay',
    severity: 'warn',
    code: 'relay-feed-incomplete',
    message: 'Relay feed scan window did not complete.',
    context: {
      feedKey: request.key,
      groupKey,
      since: bounds.since,
      until: bounds.until,
      reason: incompleteReason(statuses),
    },
  });
}

function incompleteReason(statuses: readonly ReadPageRelayStatus[]): string {
  if (statuses.length === 0) return 'missing-status';
  if (statuses.some((status) => status.timeout)) return 'timeout';
  if (statuses.some((status) => status.auth)) return 'auth';
  if (statuses.some((status) => status.socketClosed)) return 'socket-closed';
  if (statuses.some((status) => status.socketError)) return 'socket-error';
  if (statuses.some((status) => status.closed)) return 'closed';
  return 'no-eose';
}
