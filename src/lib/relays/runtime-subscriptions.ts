import { type RelayPool } from './relay-pool';
import {
  RelaySubscriptionManager,
  sharedSubscriptionManager,
} from './subscription-manager';

export function runtimeSubscriptions(
  pool?: RelayPool,
  subscriptions?: RelaySubscriptionManager,
): RelaySubscriptionManager {
  if (subscriptions) return subscriptions;
  return pool ? new RelaySubscriptionManager(pool) : sharedSubscriptionManager;
}
