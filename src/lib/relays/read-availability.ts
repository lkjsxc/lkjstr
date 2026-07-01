import { DEFAULT_RELAYS } from './default-relays';
import { selectedUserReadRelays, sortedRelayUrls } from './relay-selection';
import type { RelaySet } from './relay-types';

export type SessionDefaultReadPolicy = 'allowed' | 'forbidden';

export type EffectiveReadRelaySource =
  | 'durable-settings'
  | 'durable-empty'
  | 'session-default-public-read'
  | 'settings-unavailable';

export type EffectiveReadRelays = {
  readonly source: EffectiveReadRelaySource;
  readonly relays: string[];
  readonly diagnostic?: string;
  readonly writeAllowed: boolean;
};

export function durableRelayReadPlan(
  relaySets: readonly RelaySet[],
): EffectiveReadRelays {
  const relays = selectedUserReadRelays(relaySets);
  return {
    source: relays.length > 0 ? 'durable-settings' : 'durable-empty',
    relays,
    writeAllowed: true,
  };
}

export function unavailableRelayReadPlan(
  reason: string,
  policy: SessionDefaultReadPolicy,
): EffectiveReadRelays {
  if (policy === 'forbidden')
    return {
      source: 'settings-unavailable',
      relays: [],
      diagnostic: `Relay settings unavailable: ${reason}.`,
      writeAllowed: false,
    };
  return {
    source: 'session-default-public-read',
    relays: sessionDefaultPublicReadRelays(),
    diagnostic: `Relay settings unavailable: ${reason}; using session default public read relays.`,
    writeAllowed: false,
  };
}

export function sessionDefaultPublicReadRelays(): string[] {
  return sortedRelayUrls(DEFAULT_RELAYS);
}

export function readRelaysAvailable(plan: EffectiveReadRelays): boolean {
  return plan.relays.length > 0;
}
