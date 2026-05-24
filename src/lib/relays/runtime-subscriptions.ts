import { type RelayPool } from './relay-pool';
import {
  createRelaySubscriptionManager,
  sharedSubscriptionManager,
  type RelaySubscriptionManager,
} from './subscription-manager';

export function runtimeSubscriptions(
  pool?: RelayPool,
  subscriptions?: RelaySubscriptionManager,
): RelaySubscriptionManager {
  if (subscriptions) return subscriptions;
  return pool
    ? createRelaySubscriptionManager(pool)
    : sharedSubscriptionManager;
}
