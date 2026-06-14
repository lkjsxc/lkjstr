import type { RelayReadRequest } from '../../events/types';
import type { NostrEvent } from '../../protocol';
import type { PoolEvent } from '../relay-pool';
import type { RelaySubscriptionManager } from '../subscription-manager';
import type { Demand } from './demand-types';
import type { DemandRegistry } from './demand-registry';
import { isRenderCriticalForSurface } from './ingress-classify';
import { incOrchestrationMetric } from './metrics';

export type LiveLease = {
  readonly fingerprint: string;
  readonly listeners: Set<(event: PoolEvent) => void>;
  readonly demand: Demand;
  releaseManager: (() => void) | undefined;
};

function acceptLiveEvent(demand: Demand, event: NostrEvent): boolean {
  if (demand.purpose !== 'feed') return true;
  return isRenderCriticalForSurface(demand.surface, event);
}

export function createLiveLeaseController(
  manager: RelaySubscriptionManager,
  registry: DemandRegistry,
  liveLeases: Map<string, LiveLease>,
  toRequest: (demand: Demand) => RelayReadRequest,
  syncLiveGauge: () => void,
) {
  const openWire = (lease: LiveLease): void => {
    lease.releaseManager = manager.subscribeLive(
      toRequest(lease.demand),
      (event) => {
        incOrchestrationMetric('eventsReceived');
        if (!acceptLiveEvent(lease.demand, event.event)) {
          incOrchestrationMetric('eventsDroppedNonRenderCritical');
          return;
        }
        incOrchestrationMetric('eventsAccepted');
        lease.listeners.forEach((item) => item(event));
      },
    );
    incOrchestrationMetric('relayReqTotal');
    syncLiveGauge();
  };

  const closeWire = (lease: LiveLease): boolean => {
    const release = lease.releaseManager;
    if (!release) return false;
    release();
    lease.releaseManager = undefined;
    incOrchestrationMetric('relayCloseTotal');
    return true;
  };

  const detachLive = (fingerprint: string, owner: string): void => {
    registry.release(owner, fingerprint);
    const lease = liveLeases.get(fingerprint);
    if (!lease) return;
    if (registry.hasOwners(fingerprint)) {
      if (registry.visibleOwnerCount(fingerprint) === 0 && closeWire(lease)) {
        syncLiveGauge();
      }
      return;
    }
    closeWire(lease);
    liveLeases.delete(fingerprint);
    syncLiveGauge();
  };

  const suspendLive = (fingerprint: string): void => {
    const lease = liveLeases.get(fingerprint);
    if (lease && closeWire(lease)) syncLiveGauge();
  };

  const resumeLive = (fingerprint: string): void => {
    const lease = liveLeases.get(fingerprint);
    if (!lease || lease.releaseManager) return;
    openWire(lease);
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
      lease = {
        fingerprint,
        listeners,
        demand,
        releaseManager: undefined,
      };
      liveLeases.set(fingerprint, lease);
      if (demand.visibility === 'visible') openWire(lease);
    }
    const wrapped = (event: PoolEvent): void => {
      if (!acceptLiveEvent(demand, event.event)) {
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

  const pauseOwner = (owner: string): void => {
    registry.setOwnerVisibility(owner, 'hidden');
    for (const fingerprint of liveLeases.keys()) {
      if (registry.visibleOwnerCount(fingerprint) > 0) continue;
      suspendLive(fingerprint);
    }
  };

  const resumeOwner = (owner: string): void => {
    registry.setOwnerVisibility(owner, 'visible');
    for (const fingerprint of registry.fingerprintsForOwner(owner)) {
      if (registry.visibleOwnerCount(fingerprint) === 0) continue;
      resumeLive(fingerprint);
    }
  };

  return { attachLive, detachLive, pauseOwner, resumeOwner };
}

export function releaseOwnerLeases(
  owner: string,
  registry: DemandRegistry,
  liveLeases: Map<string, LiveLease>,
  detachLive: (fingerprint: string, owner: string) => void,
): void {
  for (const fingerprint of liveLeases.keys()) {
    if (registry.ownersFor(fingerprint).some((item) => item.owner === owner)) {
      detachLive(fingerprint, owner);
    }
  }
  registry.releaseOwner(owner);
}
