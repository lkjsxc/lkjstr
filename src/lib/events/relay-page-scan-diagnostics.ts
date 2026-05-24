import type { NostrFilter } from '../protocol';
import type { ReadPageRelayStatus } from '../relays/read-page-status';
import { appendAppLog } from '../log/app-log';
import { saveFeedCoverage } from './feed-coverage-store';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedCoverageStatus } from './types';

export type ScanCoverageMeta = {
  readonly reason?: string;
  readonly limit?: number;
  readonly eventCount?: number;
  readonly uniqueCount?: number;
  readonly attempt?: number;
  readonly durationMs?: number;
};

export async function recordScanCoverage(
  request: RelayGroupPageRequest,
  groupKey: string,
  relays: readonly string[],
  filters: readonly NostrFilter[],
  status: FeedCoverageStatus,
  meta: ScanCoverageMeta = {},
): Promise<void> {
  await Promise.all(
    relays.flatMap((relayUrl) =>
      filters.map((filter) =>
        saveFeedCoverage({
          feedKey: request.key,
          relayUrl,
          groupKey,
          filterKey: semanticFilterKey(filter),
          status,
          since: filter.since,
          until: filter.until,
          reason: meta.reason,
          limit: meta.limit,
          eventCount: meta.eventCount,
          uniqueCount: meta.uniqueCount,
          attempt: meta.attempt,
          durationMs: meta.durationMs,
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

export function incompleteReason(
  statuses: readonly ReadPageRelayStatus[],
): string {
  if (statuses.length === 0) return 'missing-status';
  if (statuses.some((status) => status.timeout)) return 'timeout';
  if (statuses.some((status) => status.auth)) return 'auth';
  if (statuses.some((status) => status.socketError)) return 'socket-error';
  if (statuses.some((status) => status.closed || status.socketClosed))
    return 'closed';
  if (statuses.some((status) => status.eventLimitReached)) return 'event-limit';
  return 'no-eose';
}

function semanticFilterKey(filter: NostrFilter): string {
  const tags = Object.entries(filter)
    .filter(([key]) => key.startsWith('#'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, Array.isArray(value) ? sorted(value) : value]);
  return JSON.stringify({
    ids: sorted(filter.ids),
    authors: sorted(filter.authors),
    kinds: sorted(filter.kinds),
    tags,
    search: filter.search,
  });
}

function sorted<T extends string | number>(
  values: readonly T[] | undefined,
): T[] | undefined {
  return values ? [...values].sort() : undefined;
}
