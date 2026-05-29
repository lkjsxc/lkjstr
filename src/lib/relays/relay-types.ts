import type { RelayConnectionState } from './types';
import type { RelayPurpose } from './relay-purpose';

export type RelayRecord = {
  readonly url: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly read: boolean;
  readonly write: boolean;
  readonly state: RelayConnectionState;
  readonly lastError?: string;
  readonly lastConnectedAt?: number;
  readonly updatedAt: number;
  readonly health: { attempts: number; successes: number; failures: number };
};

export type RelaySet = {
  readonly id: string;
  readonly name: string;
  readonly purpose: RelayPurpose;
  readonly isDefault?: boolean;
  readonly seeded: boolean;
  readonly relays: readonly RelayRecord[];
  readonly updatedAt: number;
};
