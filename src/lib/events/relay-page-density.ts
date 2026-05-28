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
  readonly perRelay: readonly RelayDensityRow[];
};

export type RelayDensityRow = {
  readonly relay: string;
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
    const row = densityRow('statusless', {
      observedCount,
      limit,
      eventCount: result.events.length,
      uniqueCount,
    });
    return {
      dense: row.dense,
      hitLimit: row.hitLimit,
      underHalfLimit: row.underHalfLimit,
      observedCount,
      limit,
      eventCount: result.events.length,
      uniqueCount,
      perRelay: [row],
    };
  }
  const perRelay = result.statuses.map((status) =>
    relayDensity(status, result.events, filters, pageSize),
  );
  const hitLimit = perRelay.some((verdict) => verdict.hitLimit);
  return {
    dense: hitLimit,
    hitLimit,
    underHalfLimit: perRelay.every((verdict) => verdict.underHalfLimit),
    observedCount: Math.max(
      ...perRelay.map((verdict) => verdict.observedCount),
    ),
    limit: Math.min(...perRelay.map((verdict) => verdict.limit)),
    eventCount: perRelay.reduce((sum, verdict) => sum + verdict.eventCount, 0),
    uniqueCount: new Set(result.events.map((item) => item.event.id)).size,
    perRelay,
  };
}

function relayDensity(
  status: ReadPageRelayStatus,
  events: readonly PoolEvent[],
  filters: readonly NostrFilter[],
  pageSize: number,
): RelayDensityRow {
  const relayEvents = events.filter((item) => item.relay === status.relay);
  const uniqueCount = new Set(relayEvents.map((item) => item.event.id)).size;
  const eventCount = Math.max(
    relayEvents.length,
    status.finalCount,
    status.candidateCount,
  );
  const limit = relayBudget(filters, pageSize);
  const observedCount = Math.max(eventCount, uniqueCount);
  return densityRow(status.relay, {
    observedCount,
    limit,
    eventCount,
    uniqueCount,
  });
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
  return !hitLimit && observedCount <= Math.floor(limit / 2);
}

function densityRow(
  relay: string,
  input: Pick<
    RelayDensityRow,
    'observedCount' | 'limit' | 'eventCount' | 'uniqueCount'
  >,
): RelayDensityRow {
  const hitLimit = reachedLimit(
    input.observedCount,
    input.uniqueCount,
    input.limit,
  );
  return {
    relay,
    dense: hitLimit,
    hitLimit,
    underHalfLimit: underHalf(input.observedCount, input.limit, hitLimit),
    ...input,
  };
}
