import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import { retainedCandidateLimit } from './relay-page-scan-items';
import type { FeedEvent } from './types';

export type RelayCandidateRetentionInput = {
  readonly events: readonly PoolEvent[];
  readonly pageSize: number;
  readonly limit?: number;
};

export function retainedRawCandidates(
  events: readonly PoolEvent[],
  pageSize: number,
  limit = retainedCandidateLimit(pageSize),
): PoolEvent[] {
  const retainedIds = new Set(
    retainRelayCandidates({ events, pageSize, limit }).map(
      (item) => item.event.id,
    ),
  );
  return events.filter((item) => retainedIds.has(item.event.id));
}

export function retainRelayCandidates(
  input: RelayCandidateRetentionInput,
): FeedEvent[] {
  const limit = Math.max(
    1,
    Math.floor(input.limit ?? retainedCandidateLimit(input.pageSize)),
  );
  const byId = new Map<string, FeedEvent>();
  const retained: FeedEvent[] = [];
  for (const item of input.events) {
    const existing = byId.get(item.event.id);
    if (existing) {
      const merged = {
        event:
          compareCandidate(item.event, existing.event) < 0
            ? item.event
            : existing.event,
        relays: [...new Set([...existing.relays, item.relay])].sort(),
      };
      byId.set(item.event.id, merged);
      const index = retained.findIndex(
        (entry) => entry.event.id === item.event.id,
      );
      if (index >= 0) retained[index] = merged;
      continue;
    }
    const candidate = { event: item.event, relays: [item.relay] };
    const removed = insertCandidate(retained, candidate, limit);
    if (removed) byId.delete(removed);
    if (retained.includes(candidate)) byId.set(item.event.id, candidate);
  }
  return retained;
}

export function scaleFilters(
  filters: readonly NostrFilter[],
  multiplier: number,
): NostrFilter[] {
  return filters.map((filter) => ({
    ...filter,
    limit: (filter.limit ?? 1) * multiplier,
  }));
}

function insertCandidate(
  retained: FeedEvent[],
  candidate: FeedEvent,
  limit: number,
): string | undefined {
  const index = retained.findIndex(
    (item) => compareCandidate(candidate.event, item.event) < 0,
  );
  if (index === -1) retained.push(candidate);
  else retained.splice(index, 0, candidate);
  if (retained.length > limit) {
    const removed = retained.pop();
    return removed?.event.id;
  }
  return undefined;
}

function compareCandidate(
  a: FeedEvent['event'],
  b: FeedEvent['event'],
): number {
  if (a.created_at !== b.created_at) return b.created_at - a.created_at;
  return a.id.localeCompare(b.id);
}
