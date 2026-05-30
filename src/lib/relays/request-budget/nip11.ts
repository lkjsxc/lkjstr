import { maxRelaySubscriptionIdLength } from '../subscription-id';
import type { RelayInformationDocument } from '../relay-info';
import type { RequestBudgetWarning } from './types';

export type NIP11RequestConstraints = {
  readonly maxLimit?: number;
  readonly defaultLimit?: number;
  readonly maxMessageLength?: number;
  readonly maxSubscriptions: number;
  readonly maxSubscriptionIdLength: number;
  readonly warnings: readonly RequestBudgetWarning[];
};

export function nip11RequestConstraints(
  info: RelayInformationDocument | undefined,
): NIP11RequestConstraints {
  const limit = info?.limitation;
  return {
    maxLimit: limit?.maxLimit,
    defaultLimit: limit?.defaultLimit,
    maxMessageLength: limit?.maxMessageLength,
    maxSubscriptions: limit?.maxSubscriptions ?? Infinity,
    maxSubscriptionIdLength: Math.min(
      limit?.maxSubIdLength ?? maxRelaySubscriptionIdLength,
      maxRelaySubscriptionIdLength,
    ),
    warnings: policyWarnings(info),
  };
}

function policyWarnings(
  info: RelayInformationDocument | undefined,
): RequestBudgetWarning[] {
  const limit = info?.limitation;
  if (!limit) return [];
  return [
    limit.authRequired
      ? warning('auth-required', 'relay advertises read authentication')
      : undefined,
    limit.paymentRequired
      ? warning('payment-required', 'relay advertises payment policy')
      : undefined,
    limit.restrictedWrites
      ? warning('restricted-writes', 'relay advertises restricted writes')
      : undefined,
    limit.minPowDifficulty
      ? warning('pow-required', 'relay advertises proof-of-work policy')
      : undefined,
    limit.createdAtLowerLimit || limit.createdAtUpperLimit
      ? warning('created-at-bound', 'relay advertises created-at bounds')
      : undefined,
  ].filter((item): item is RequestBudgetWarning => Boolean(item));
}

function warning(
  kind: RequestBudgetWarning['kind'],
  message: string,
): RequestBudgetWarning {
  return { kind, message };
}
