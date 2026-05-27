import { type RelayPool } from './relay-pool';
import {
  createSubscriptionOrchestrator,
  sharedSubscriptionOrchestrator,
  type SubscriptionOrchestrator,
} from './orchestration/orchestrator';
import {
  createRelaySubscriptionManager,
  type RelaySubscriptionManager,
} from './subscription-manager';

export function runtimeSubscriptions(
  pool?: RelayPool,
  subscriptions?: RelaySubscriptionManager | SubscriptionOrchestrator,
): SubscriptionOrchestrator {
  if (subscriptions) {
    return subscriptions as SubscriptionOrchestrator;
  }
  if (pool) {
    return createSubscriptionOrchestrator(
      pool,
      createRelaySubscriptionManager(pool),
    );
  }
  return sharedSubscriptionOrchestrator;
}
