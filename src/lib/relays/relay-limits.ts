import { cachedRelayInformation } from './relay-info';
import { maxRelaySubscriptionIdLength } from './subscription-id';

export type RelayLimits = {
  readonly maxSubscriptions: number;
  readonly maxLimit?: number;
  readonly maxMessageLength?: number;
  readonly maxSubscriptionIdLength: number;
};

export function relayLimits(relayUrl: string): RelayLimits {
  const limit = cachedRelayInformation(relayUrl)?.info?.limitation ?? {};
  return {
    maxSubscriptions: limit.maxSubscriptions ?? Infinity,
    maxLimit: limit.maxLimit,
    maxMessageLength: limit.maxMessageLength,
    maxSubscriptionIdLength: Math.min(
      limit.maxSubIdLength ?? maxRelaySubscriptionIdLength,
      maxRelaySubscriptionIdLength,
    ),
  };
}
