import type { RelayReadRequest } from '../../events/types';
import type { PoolEvent } from '../relay-pool';
import { sharedRelayPool, type RelayPool } from '../relay-pool';
import type { RelayRequestPurpose } from '../relay-request-compat';
import {
  createRelaySubscriptionManager,
  sharedSubscriptionManager,
  type RelaySubscriptionManager,
} from '../subscription-manager';
import { childRelaySubscriptionId } from '../subscription-id';
import type { ReadPageOptions } from '../subscription-manager-types';
import type { ReadPageResult } from '../read-page-status';
import { demandFingerprintInput } from './compatible';
import { createDemandRegistry } from './demand-registry';
import type { Demand, DemandVisibility } from './demand-types';
import { isRenderCriticalForSurface } from './ingress-classify';
import { leaseFingerprint, leaseWireKey } from './lease-fingerprint';
import {
  incOrchestrationMetric,
  orchestrationMetricsSnapshot,
  setOrchestrationGauge,
  type OrchestrationMetrics,
} from './metrics';

type LiveLease = {
  readonly fingerprint: string;
  readonly listeners: Set<(event: PoolEvent) => void>;
  readonly releaseManager: () => void;
};

export type SubscriptionOrchestrator = RelaySubscriptionManager & {
  readonly subscribeDemand: (
    demand: Demand,
    listener: (event: PoolEvent) => void,
  ) => () => void;
  readonly readDemandPage: (
    demand: Demand,
    options?: ReadPageOptions,
  ) => Promise<ReadPageResult>;
  readonly pauseOwner: (owner: string) => void;
  readonly resumeOwner: (owner: string) => void;
  readonly releaseOwner: (owner: string) => void;
  readonly metricsSnapshot: () => OrchestrationMetrics;
};

export function createSubscriptionOrchestrator(
  pool: RelayPool = sharedRelayPool,
  manager: RelaySubscriptionManager = createRelaySubscriptionManager(pool),
): SubscriptionOrchestrator {
  const registry = createDemandRegistry();
  const liveLeases = new Map<string, LiveLease>();
  let bootstrapInFlight = 0;

  const syncLiveGauge = (): void => {
    setOrchestrationGauge('liveLeases', liveLeases.size);
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

  const toRequest = (demand: Demand): RelayReadRequest => {
    const fingerprint = leaseFingerprint(demandFingerprintInput(demand));
    return {
      key: leaseWireKey(fingerprint),
      relays: demand.relays,
      filters: demandFilters(demand),
      purpose: demand.purpose,
    };
  };

  const fanOut = (demand: Demand, event: PoolEvent): void => {
    incOrchestrationMetric('eventsReceived');
    if (!isRenderCriticalForSurface(demand.surface, event.event)) {
      incOrchestrationMetric('eventsDroppedNonRenderCritical');
      return;
    }
    incOrchestrationMetric('eventsAccepted');
    const lease = liveLeases.get(
      leaseFingerprint(demandFingerprintInput(demand)),
    );
    lease?.listeners.forEach((listener) => listener(event));
  };

  const detachLive = (fingerprint: string, owner: string): void => {
    registry.release(owner, fingerprint);
    const lease = liveLeases.get(fingerprint);
    if (!lease || registry.hasOwners(fingerprint)) return;
    lease.releaseManager();
    liveLeases.delete(fingerprint);
    incOrchestrationMetric('relayCloseTotal');
    syncLiveGauge();
  };

  const attachLive = (
    demand: Demand,
    listener: (event: PoolEvent) => void,
  ): (() => void) => {
    const fingerprint = registry.register(demand);
    if (demand.visibility === 'hidden') {
      return () => detachLive(fingerprint, demand.owner);
    }
    let lease = liveLeases.get(fingerprint);
    if (!lease) {
      const listeners = new Set<(event: PoolEvent) => void>();
      const request = toRequest(demand);
      const releaseManager = manager.subscribeLive(request, (event) => {
        incOrchestrationMetric('eventsReceived');
        if (!isRenderCriticalForSurface(demand.surface, event.event)) {
          incOrchestrationMetric('eventsDroppedNonRenderCritical');
          return;
        }
        incOrchestrationMetric('eventsAccepted');
        listeners.forEach((item) => item(event));
      });
      lease = { fingerprint, listeners, releaseManager };
      liveLeases.set(fingerprint, lease);
      incOrchestrationMetric('relayReqTotal');
      syncLiveGauge();
    }
    const wrapped = (event: PoolEvent): void => {
      if (!isRenderCriticalForSurface(demand.surface, event.event)) {
        incOrchestrationMetric('eventsDroppedNonRenderCritical');
        return;
      }
      listener(event);
    };
    lease.listeners.add(wrapped);
    return () => {
      lease?.listeners.delete(wrapped);
      detachLive(fingerprint, demand.owner);
    };
  };

  return {
    subscribeLive: (
      request: RelayReadRequest,
      listener: (event: PoolEvent) => void,
    ): (() => void) => {
      const demand: Demand = {
        surface: 'home',
        phase: 'live',
        relays: request.relays,
        filters: request.filters,
        purpose: request.purpose as RelayRequestPurpose,
        owner: request.key,
        visibility: 'visible',
      };
      return attachLive(demand, listener);
    },
    subscribeDemand: attachLive,
    readDemandPage: (demand: Demand, options: ReadPageOptions = {}) => {
      const fingerprint = registry.register(demand);
      incOrchestrationMetric('relayReqTotal');
      if (demand.phase === 'bootstrap') {
        bootstrapInFlight += 1;
        syncLiveGauge();
      }
      return manager.readPageDetailed(toRequest(demand), options).finally(() => {
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
      for (const lease of liveLeases.values()) {
        lease.releaseManager();
      }
      liveLeases.clear();
      bootstrapInFlight = 0;
      manager.close();
      syncLiveGauge();
    },
    counts: manager.counts.bind(manager),
    pauseOwner: (owner: string): void => {
      registry.setOwnerVisibility(owner, 'hidden');
      for (const fingerprint of [...liveLeases.keys()]) {
        if (registry.visibleOwnerCount(fingerprint) > 0) continue;
        const lease = liveLeases.get(fingerprint);
        lease?.releaseManager();
        liveLeases.delete(fingerprint);
        incOrchestrationMetric('relayCloseTotal');
      }
      syncLiveGauge();
    },
    resumeOwner: (owner: string): void => {
      registry.setOwnerVisibility(owner, 'visible');
    },
    releaseOwner: (owner: string): void => {
      const fingerprints = new Set<string>();
      for (const fingerprint of liveLeases.keys()) {
        if (
          registry
            .ownersFor(fingerprint)
            .some((item) => item.owner === owner)
        ) {
          fingerprints.add(fingerprint);
        }
      }
      for (const fingerprint of fingerprints) {
        detachLive(fingerprint, owner);
      }
      registry.releaseOwner(owner);
    },
    metricsSnapshot: orchestrationMetricsSnapshot,
  };
}

export const sharedSubscriptionOrchestrator = createSubscriptionOrchestrator(
  sharedRelayPool,
  sharedSubscriptionManager,
);

function demandWireKey(demand: Demand, keyPrefix?: string): string {
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
