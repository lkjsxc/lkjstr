import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type {
  ReadPageRelayStatus,
  ReadPageResult,
} from '../relays/read-page-status';

export type RelayDensityVerdict = {
  readonly dense: boolean;
  readonly limit: number;
  readonly eventCount: number;
  readonly uniqueCount: number;
};

export function relayPageDensity(
  result: ReadPageResult,
  filters: readonly NostrFilter[],
  pageSize: number,
): RelayDensityVerdict {
  if (result.statuses.length === 0) {
    const limit = relayBudget(filters, pageSize);
    const uniqueCount = new Set(result.events.map((item) => item.event.id))
      .size;
    return {
      dense: result.events.length >= limit || uniqueCount >= limit,
      limit,
      eventCount: result.events.length,
      uniqueCount,
    };
  }
  const verdicts = result.statuses.map((status) =>
    relayDensity(status, result.events, filters, pageSize),
  );
  const dense = verdicts.some((verdict) => verdict.dense);
  return {
    dense,
    limit: Math.min(...verdicts.map((verdict) => verdict.limit)),
    eventCount: verdicts.reduce((sum, verdict) => sum + verdict.eventCount, 0),
    uniqueCount: new Set(result.events.map((item) => item.event.id)).size,
  };
}

function relayDensity(
  status: ReadPageRelayStatus,
  events: readonly PoolEvent[],
  filters: readonly NostrFilter[],
  pageSize: number,
): RelayDensityVerdict {
  const relayEvents = events.filter((item) => item.relay === status.relay);
  const uniqueCount = new Set(relayEvents.map((item) => item.event.id)).size;
  const eventCount = Math.max(
    relayEvents.length,
    status.finalCount,
    status.candidateCount,
  );
  const limit = relayBudget(filters, pageSize);
  return {
    dense: eventCount >= limit || uniqueCount >= limit,
    limit,
    eventCount,
    uniqueCount,
  };
}

function relayBudget(
  filters: readonly NostrFilter[],
  pageSize: number,
): number {
  return Math.max(
    1,
    filters.reduce((sum, filter) => sum + (filter.limit ?? pageSize), 0),
  );
}
