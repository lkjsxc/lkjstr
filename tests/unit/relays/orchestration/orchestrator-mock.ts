import type { RelaySubscriptionManager } from '../../../../src/lib/relays/subscription-manager';
import { managerAsOrchestrator } from '../../../../src/lib/relays/orchestration/orchestrator-adapter';
import type { SubscriptionOrchestrator } from '../../../../src/lib/relays/orchestration/orchestrator-types';
import type { OrchestrationMetrics } from '../../../../src/lib/relays/orchestration/metrics';

const emptyMetrics = (): OrchestrationMetrics => ({
  activeDemands: 0,
  activeLeases: 0,
  liveLeases: 0,
  bootstrapLeases: 0,
  relayReqTotal: 0,
  relayCloseTotal: 0,
  eventsReceived: 0,
  eventsAccepted: 0,
  eventsDroppedDuplicate: 0,
  eventsDroppedNonRenderCritical: 0,
});

export function orchestratorFromManager(
  manager: RelaySubscriptionManager,
): SubscriptionOrchestrator {
  return managerAsOrchestrator(manager);
}

export function stubOrchestrator(
  partial: Partial<SubscriptionOrchestrator> = {},
): SubscriptionOrchestrator {
  const base: SubscriptionOrchestrator = {
    subscribeState: () => () => undefined,
    readPage: async () => [],
    readPageDetailed: async () => ({ events: [], statuses: [] }),
    close: () => undefined,
    counts: () => ({
      liveSubscriptions: 0,
      liveListeners: 0,
      inFlightReads: 0,
    }),
    subscribeDemand: () => () => undefined,
    submitLiveIntent: () => () => undefined,
    submitHomeNotesLiveIntent: async () => () => undefined,
    readPageByIntent: async () => ({ events: [], statuses: [] }),
    readDemandPage: async () => ({ events: [], statuses: [] }),
    pauseOwner: () => undefined,
    resumeOwner: () => undefined,
    releaseOwner: () => undefined,
    metricsSnapshot: emptyMetrics,
    ...partial,
  };
  return base;
}
