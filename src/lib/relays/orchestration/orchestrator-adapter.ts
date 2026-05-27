import type { RelayReadRequest } from '../../events/types';
import type { PoolEvent } from '../relay-pool';
import { type RelaySubscriptionManager } from '../subscription-manager';
import { childRelaySubscriptionId } from '../subscription-id';
import { demandFingerprintInput } from './compatible';
import type { Demand } from './demand-types';
import { leaseFingerprint, leaseWireKey } from './lease-fingerprint';
import { orchestrationMetricsSnapshot } from './metrics';
import type { SubscriptionOrchestrator } from './orchestrator-types';

export function demandWireKey(demand: Demand, keyPrefix?: string): string {
  if (demand.channel && keyPrefix) {
    return childRelaySubscriptionId(keyPrefix, demand.channel);
  }
  return leaseWireKey(leaseFingerprint(demandFingerprintInput(demand)));
}

export function managerAsOrchestrator(
  manager: RelaySubscriptionManager,
  options: { readonly keyPrefix?: string } = {},
): SubscriptionOrchestrator {
  return {
    ...manager,
    subscribeDemand: (demand, listener) =>
      manager.subscribeLive(
        {
          key: demandWireKey(demand, options.keyPrefix),
          relays: demand.relays,
          filters: demand.filters,
          purpose: demand.purpose,
        },
        listener,
      ),
    readDemandPage: (demand, pageOptions) =>
      manager.readPageDetailed(
        {
          key: demandWireKey(demand, options.keyPrefix),
          relays: demand.relays,
          filters: demand.filters,
          purpose: demand.purpose,
        },
        pageOptions,
      ),
    pauseOwner: () => undefined,
    resumeOwner: () => undefined,
    releaseOwner: () => undefined,
    metricsSnapshot: orchestrationMetricsSnapshot,
  };
}

export function legacySubscribeLive(
  request: RelayReadRequest,
  listener: (event: PoolEvent) => void,
  attachLive: SubscriptionOrchestrator['subscribeDemand'],
): () => void {
  return attachLive(
    {
      surface: 'home',
      phase: 'live',
      relays: request.relays,
      filters: request.filters,
      purpose: request.purpose as Demand['purpose'],
      owner: request.key,
      visibility: 'visible',
    },
    listener,
  );
}
