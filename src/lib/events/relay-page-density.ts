import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import type {
  ReadPageRelayStatus,
  ReadPageResult,
} from '../relays/read-page-status';

export type RelayDensityVerdict = {
  readonly dense: boolean;
  readonly hitLimit: boolean;
  readonly underHalfLimit: boolean;
  readonly observedCount: number;
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
    const observedCount = Math.max(result.events.length, uniqueCount);
    const hitLimit = reachedLimit(observedCount, uniqueCount, limit);
    return {
      dense: hitLimit,
      hitLimit,
      underHalfLimit: underHalf(observedCount, limit, hitLimit),
      observedCount,
      limit,
      eventCount: result.events.length,
      uniqueCount,
    };
  }
  const verdicts = result.statuses.map((status) =>
    relayDensity(status, result.events, filters, pageSize),
  );
  const hitLimit = verdicts.some((verdict) => verdict.hitLimit);
  return {
    dense: hitLimit,
    hitLimit,
    underHalfLimit: verdicts.every((verdict) => verdict.underHalfLimit),
    observedCount: Math.max(
      ...verdicts.map((verdict) => verdict.observedCount),
    ),
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
  const observedCount = Math.max(eventCount, uniqueCount);
  const hitLimit = reachedLimit(observedCount, uniqueCount, limit);
  return {
    dense: hitLimit,
    hitLimit,
    underHalfLimit: underHalf(observedCount, limit, hitLimit),
    observedCount,
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

function reachedLimit(
  observedCount: number,
  uniqueCount: number,
  limit: number,
): boolean {
  return observedCount >= limit || uniqueCount >= limit;
}

function underHalf(
  observedCount: number,
  limit: number,
  hitLimit: boolean,
): boolean {
  return !hitLimit && observedCount < limit / 2;
}
