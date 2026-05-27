import { type RelaySubscriptionManager } from '../subscription-manager';
import { childRelaySubscriptionId } from '../subscription-id';
import { buildHomeNotesLiveDemand, buildLiveDemand } from './demand-build';
import type { Demand } from './demand-types';
import { demandToWireRequest } from './lease-key';
import { orchestrationMetricsSnapshot } from './metrics';
import type { SubscriptionOrchestrator } from './orchestrator-types';
import { readPageByIntent } from './page-reads';

export function demandWireKey(demand: Demand, keyPrefix?: string): string {
  if (demand.channel && keyPrefix) {
    return childRelaySubscriptionId(keyPrefix, demand.channel);
  }
  return demandToWireRequest(demand).key;
}

export function managerAsOrchestrator(
  manager: RelaySubscriptionManager,
  options: { readonly keyPrefix?: string } = {},
): SubscriptionOrchestrator {
  const api: SubscriptionOrchestrator = {
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
    submitLiveIntent: (intent, relays, listener) =>
      manager.subscribeLive(
        {
          key: demandToWireRequest(buildLiveDemand(intent, relays)).key,
          relays,
          filters: intent.filters,
          purpose: intent.purpose,
        },
        listener,
      ),
    submitHomeNotesLiveIntent: async (intent, listener) => {
      const demand = await buildHomeNotesLiveDemand(intent);
      return manager.subscribeLive(demandToWireRequest(demand), listener);
    },
    readPageByIntent: (intent, pageOptions) =>
      readPageByIntent(api, intent, pageOptions),
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
  return api;
}
