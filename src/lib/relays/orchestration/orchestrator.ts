import type { RelayReadRequest } from '../../events/types';
import type { PoolEvent } from '../relay-pool';
import { sharedRelayPool, type RelayPool } from '../relay-pool';
import {
  createRelaySubscriptionManager,
  sharedSubscriptionManager,
  type RelaySubscriptionManager,
} from '../subscription-manager';
import type { ReadPageOptions } from '../subscription-manager-types';
import type { ReadPageResult } from '../read-page-status';
import { createDemandRegistry } from './demand-registry';
import type { Demand } from './demand-types';
import { buildHomeNotesLiveDemand, buildLiveDemand } from './demand-build';
import type {
  HomeNotesLiveIntent,
  LiveIntent,
  PageIntent,
} from './intent-types';
import { demandToWireRequest } from './lease-key';
import {
  createLiveLeaseController,
  noopLiveRelease,
  releaseOwnerLeases,
  type LiveLease,
} from './orchestrator-live';
import { readPageByIntent as readPageByIntentExec } from './page-reads';
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

  const toRequest = (demand: Demand): RelayReadRequest =>
    demandToWireRequest(demand);

  const { attachLive, detachLive, pauseOwner, resumeOwner } =
    createLiveLeaseController(
      manager,
      registry,
      liveLeases,
      toRequest,
      syncLiveGauge,
    );

  const submitLiveIntent = (
    intent: LiveIntent,
    relays: readonly string[],
    listener: (event: PoolEvent) => void,
  ): (() => void) => attachLive(buildLiveDemand(intent, relays), listener);

  const submitHomeNotesLiveIntent = async (
    intent: HomeNotesLiveIntent,
    listener: (event: PoolEvent) => void,
  ): Promise<() => void> =>
    attachLive(await buildHomeNotesLiveDemand(intent), listener);

  const api = {
    subscribeDemand: attachLive,
    submitLiveIntent,
    submitHomeNotesLiveIntent,
    readPageByIntent: (
      intent: PageIntent,
      options?: ReadPageOptions,
    ): Promise<ReadPageResult> =>
      readPageByIntentExec(
        {
          readPageDetailed: manager.readPageDetailed.bind(manager),
        },
        intent,
        options,
      ),
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

  return api;
}

export const sharedSubscriptionOrchestrator = createSubscriptionOrchestrator(
  sharedRelayPool,
  sharedSubscriptionManager,
);
