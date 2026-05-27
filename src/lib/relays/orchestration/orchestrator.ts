import type { RelayReadRequest } from '../../events/types';
import type { PoolEvent } from '../relay-pool';
import { sharedRelayPool, type RelayPool } from '../relay-pool';
import {
  createRelaySubscriptionManager,
  sharedSubscriptionManager,
  type RelaySubscriptionManager,
} from '../subscription-manager';
import type { ReadPageOptions } from '../subscription-manager-types';
import { demandFingerprintInput } from './compatible';
import { createDemandRegistry } from './demand-registry';
import type { Demand } from './demand-types';
import { leaseFingerprint, leaseWireKey } from './lease-fingerprint';
import {
  createLiveLeaseController,
  noopLiveRelease,
  releaseOwnerLeases,
  type LiveLease,
} from './orchestrator-live';
import { legacySubscribeLive } from './orchestrator-adapter';
import {
  incOrchestrationMetric,
  orchestrationMetricsSnapshot,
  setOrchestrationGauge,
} from './metrics';

export type { SubscriptionOrchestrator } from './orchestrator-types';
export { managerAsOrchestrator } from './orchestrator-adapter';

export function createSubscriptionOrchestrator(
  pool: RelayPool = sharedRelayPool,
  manager: RelaySubscriptionManager = createRelaySubscriptionManager(pool),
) {
  const registry = createDemandRegistry();
  const liveLeases = new Map<string, LiveLease>();
  let bootstrapInFlight = 0;

  const syncLiveGauge = (): void => {
    let openLiveLeases = 0;
    for (const lease of liveLeases.values()) {
      if (lease.releaseManager !== noopLiveRelease) openLiveLeases += 1;
    }
    setOrchestrationGauge('liveLeases', openLiveLeases);
    setOrchestrationGauge('bootstrapLeases', bootstrapInFlight);
  };

  const demandFilters = (demand: Demand) => {
    if (demand.phase !== 'live') return demand.filters;
    const since = demand.since ?? Math.floor(Date.now() / 1000) - 30;
    return demand.filters.map((filter) => ({
      ...filter,
      since,
      limit: undefined,
    }));
  };

  const toRequest = (demand: Demand): RelayReadRequest => ({
    key: leaseWireKey(leaseFingerprint(demandFingerprintInput(demand))),
    relays: demand.relays,
    filters: demandFilters(demand),
    purpose: demand.purpose,
  });

  const { attachLive, detachLive, pauseOwner, resumeOwner } =
    createLiveLeaseController(
      manager,
      registry,
      liveLeases,
      toRequest,
      syncLiveGauge,
    );

  return {
    subscribeLive: (
      request: RelayReadRequest,
      listener: (event: PoolEvent) => void,
    ) => legacySubscribeLive(request, listener, attachLive),
    subscribeDemand: attachLive,
    readDemandPage: (demand: Demand, options: ReadPageOptions = {}) => {
      const fingerprint = registry.register(demand);
      incOrchestrationMetric('relayReqTotal');
      if (demand.phase === 'bootstrap') {
        bootstrapInFlight += 1;
        syncLiveGauge();
      }
      return manager
        .readPageDetailed(toRequest(demand), options)
        .finally(() => {
          registry.release(demand.owner, fingerprint);
          if (demand.phase === 'bootstrap') {
            bootstrapInFlight = Math.max(0, bootstrapInFlight - 1);
            syncLiveGauge();
          }
          incOrchestrationMetric('relayCloseTotal');
        });
    },
    subscribeState: manager.subscribeState.bind(manager),
    readPage: manager.readPage.bind(manager),
    readPageDetailed: manager.readPageDetailed.bind(manager),
    close: (): void => {
      for (const lease of liveLeases.values()) lease.releaseManager();
      liveLeases.clear();
      bootstrapInFlight = 0;
      manager.close();
      syncLiveGauge();
    },
    counts: manager.counts.bind(manager),
    pauseOwner,
    resumeOwner,
    releaseOwner: (owner: string): void => {
      releaseOwnerLeases(owner, registry, liveLeases, detachLive);
    },
    metricsSnapshot: orchestrationMetricsSnapshot,
  };
}

export const sharedSubscriptionOrchestrator = createSubscriptionOrchestrator(
  sharedRelayPool,
  sharedSubscriptionManager,
);
