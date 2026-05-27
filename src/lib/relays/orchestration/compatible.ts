import type { Demand } from './demand-types';
import type { LeaseFingerprintInput } from './lease-fingerprint';
import { wireEquivalentFingerprint } from './lease-key';

export function demandsCompatible(a: Demand, b: Demand): boolean {
  return wireEquivalentFingerprint(a) === wireEquivalentFingerprint(b);
}

export function demandFingerprintInput(
  demand: Demand,
): LeaseFingerprintInput & { readonly channel?: string } {
  return {
    relays: demand.relays,
    filters: demand.filters,
    phase: demand.phase,
    purpose: demand.purpose,
    since: demand.since,
    until: demand.until,
    limit: demand.limit,
    channel: demand.channel,
  };
}
