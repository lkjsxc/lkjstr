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
    maxSubscriptions: positiveInt(limit.max_subscriptions) ?? Infinity,
    maxLimit: positiveInt(limit.max_limit),
    maxMessageLength: positiveInt(limit.max_message_length),
    maxSubscriptionIdLength: Math.min(
      positiveInt(limit.max_subid_length) ??
        positiveInt(limit.max_subscription_id_length) ??
        maxRelaySubscriptionIdLength,
      maxRelaySubscriptionIdLength,
    ),
  };
}

function positiveInt(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : undefined;
}
