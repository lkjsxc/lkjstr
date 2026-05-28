import type { NostrFilter } from '../protocol';
import type { ReadPageRelayStatus } from '../relays/read-page-status';
import { appendAppLog } from '../log/app-log';
import { saveFeedCoverage } from './feed-coverage-store';
import type { RelayGroupPageRequest } from './relay-page';
import type { FeedCoverageStatus } from './types';
import type { RelayDensityRow } from './relay-page-density';

export type ScanCoverageMeta = {
  readonly reason?: string;
  readonly limit?: number;
  readonly eventCount?: number;
  readonly uniqueCount?: number;
  readonly attempt?: number;
  readonly durationMs?: number;
  readonly spanSeconds?: number;
  readonly nextSpanSeconds?: number;
  readonly feedback?: 'limit-hit' | 'under-half' | 'balanced' | 'incomplete';
  readonly direction?: 'older' | 'newer' | 'initial';
  readonly relayRows?: readonly RelayDensityRow[];
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
    relays.flatMap((relayUrl) => {
      const row = meta.relayRows?.find((item) => item.relay === relayUrl);
      return filters.map((filter) =>
        saveFeedCoverage({
          feedKey: request.key,
          relayUrl,
          groupKey,
          filterKey: semanticFilterKey(filter),
          status,
          since: filter.since,
          until: filter.until,
          reason: meta.reason,
          limit: row?.limit ?? meta.limit,
          eventCount: row?.eventCount ?? meta.eventCount,
          uniqueCount: row?.uniqueCount ?? meta.uniqueCount,
          attempt: meta.attempt,
          durationMs: meta.durationMs,
          spanSeconds: meta.spanSeconds,
          nextSpanSeconds: meta.nextSpanSeconds,
          feedback: meta.feedback,
          direction: meta.direction,
        }),
      );
    }),
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

export function semanticFilterKey(filter: NostrFilter): string {
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
