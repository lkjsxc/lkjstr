import type { NostrFilter } from '../../protocol';
import type { RelayRequestPurpose } from '../relay-request-compat';
import type { Demand, DemandSurface, DemandVisibility } from './demand-types';

export function liveFeedDemand(input: {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly channel?: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly purpose?: RelayRequestPurpose;
  readonly since?: number;
  readonly visibility?: DemandVisibility;
}): Demand {
  return {
    surface: input.surface,
    phase: 'live',
    relays: input.relays,
    filters: input.filters,
    purpose: input.purpose ?? 'feed',
    owner: input.owner,
    visibility: input.visibility ?? 'visible',
    since: input.since,
    channel: input.channel,
  };
}

export function pageFeedDemand(input: {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly purpose?: RelayRequestPurpose;
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
}): Demand {
  return {
    surface: input.surface,
    phase: 'page',
    relays: input.relays,
    filters: input.filters,
    purpose: input.purpose ?? 'feed',
    owner: input.owner,
    visibility: 'visible',
    since: input.since,
    until: input.until,
    limit: input.limit,
  };
}
