import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import { mergeBounds } from './relay-page-filter';
import {
  logIncompleteScan,
  recordScanCoverage,
} from './relay-page-scan-diagnostics';
import type { BatchReadResult } from './relay-page-scan-batch';
import { segmentBounds, type RelayPageSegment } from './relay-page-segments';
import type { RelayGroupPageRequest } from './relay-page';

export async function recordBatchCoverage(
  request: RelayGroupPageRequest,
  groupKey: string,
  relays: readonly string[],
  filters: readonly NostrFilter[],
  read: BatchReadResult,
  attempt: number,
): Promise<void> {
  await recordScanCoverage(
    request,
    groupKey,
    relays,
    filters,
    read.complete ? (read.dense ? 'dense' : 'complete') : 'incomplete',
    {
      reason: read.reason,
      limit: read.density.limit,
      eventCount: read.density.eventCount,
      uniqueCount: read.density.uniqueCount,
      attempt,
      durationMs: read.durationMs,
    },
  );
  if (!read.complete && !(read.reason === 'event-limit' && read.dense))
    logIncompleteScan(request, groupKey, filters[0] ?? {}, read.statuses);
}

export async function recordUnresolved(
  request: RelayGroupPageRequest,
  groupKey: string,
  relays: readonly string[],
  filters: readonly NostrFilter[],
  segment: RelayPageSegment,
  dense: boolean,
  raw: readonly PoolEvent[],
): Promise<void> {
  const bounds = segmentBounds(segment);
  await recordScanCoverage(
    request,
    groupKey,
    relays,
    filters.map((filter) => mergeBounds(filter, bounds)),
    'unresolved',
    {
      reason: dense ? 'dense-minimum-or-budget' : 'incomplete-minimum',
      limit: request.pageSize,
      eventCount: raw.length,
      uniqueCount: new Set(raw.map((item) => item.event.id)).size,
      attempt: 4,
    },
  );
}
