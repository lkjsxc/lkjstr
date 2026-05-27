import type { RelayReadRequest } from '../../events/types';
import type { NostrFilter } from '../../protocol';
import type { Demand } from './demand-types';
import {
  leaseFingerprint,
  leaseWireKey,
  type LeaseFingerprintInput,
} from './lease-fingerprint';

export function normalizeLiveDemandFilters(
  demand: Demand,
  nowSec = Math.floor(Date.now() / 1000),
): readonly NostrFilter[] {
  if (demand.phase !== 'live') return demand.filters;
  const since = demand.since ?? nowSec - 30;
  return demand.filters.map((filter) => ({
    ...filter,
    since,
    limit: undefined,
  }));
}

export function wireEquivalentFingerprintInput(
  demand: Demand,
  nowSec = Math.floor(Date.now() / 1000),
): LeaseFingerprintInput {
  return {
    relays: demand.relays,
    filters: normalizeLiveDemandFilters(demand, nowSec),
    phase: demand.phase,
    purpose: demand.purpose,
    since: demand.since,
    until: demand.until,
    limit: demand.limit,
    channel: demand.channel,
  };
}

export function wireEquivalentFingerprint(
  demand: Demand,
  nowSec = Math.floor(Date.now() / 1000),
): string {
  return leaseFingerprint(wireEquivalentFingerprintInput(demand, nowSec));
}

export function demandToWireRequest(
  demand: Demand,
  nowSec = Math.floor(Date.now() / 1000),
): RelayReadRequest {
  return {
    key: leaseWireKey(wireEquivalentFingerprint(demand, nowSec)),
    relays: demand.relays,
    filters: normalizeLiveDemandFilters(demand, nowSec),
    purpose: demand.purpose,
  };
}
