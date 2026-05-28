import type { RelayRequestPurpose } from './relay-request-compat';
import type { RelaySubscriptionDescriptorInput } from './types';

export type RelaySubscriptionStrategy = 'forward' | 'backward' | 'oneshot';

export type RelaySubscribeOptions = {
  readonly purpose?: RelayRequestPurpose;
  readonly strategy?: RelaySubscriptionStrategy;
  readonly idleCloseMs?: number;
  readonly descriptor?: RelaySubscriptionDescriptorInput;
};

export function relaySubscribeOptions(
  value?: RelayRequestPurpose | RelaySubscribeOptions,
): RelaySubscribeOptions {
  if (!value) return { strategy: 'forward' };
  if (typeof value === 'string') return { purpose: value, strategy: 'forward' };
  return { ...value, strategy: value.strategy ?? 'forward' };
}
