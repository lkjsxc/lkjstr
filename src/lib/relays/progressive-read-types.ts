import type { PoolEvent } from './relay-pool';
import type { ReadPageRelayStatus } from './read-page-status';

export type ProgressiveReadStatus =
  | 'idle'
  | 'cache-ready'
  | 'partial'
  | 'complete'
  | 'incomplete'
  | 'failed'
  | 'cancelled';

export type ProgressiveRelayState =
  | 'pending'
  | 'connected'
  | 'reading'
  | 'eose'
  | 'timeout'
  | 'closed'
  | 'auth'
  | 'error'
  | 'cancelled';

export type ProgressiveRelaySnapshot = {
  readonly relay: string;
  readonly state: ProgressiveRelayState;
  readonly eventCount: number;
  readonly finalCount: number;
  readonly durationMs?: number;
  readonly reason?: string;
};

export type ProgressiveReadSnapshot = {
  readonly readId: string;
  readonly surface?: string;
  readonly status: ProgressiveReadStatus;
  readonly reason: string;
  readonly events: readonly PoolEvent[];
  readonly relays: readonly ProgressiveRelaySnapshot[];
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly durationMs: number;
  readonly final: boolean;
};

export type OnProgressiveReadSnapshot = (
  snapshot: ProgressiveReadSnapshot,
) => void;

export type ProgressiveReadState = {
  readonly readId: string;
  readonly surface?: string;
  readonly startedAt: number;
  readonly relays: readonly string[];
  readonly events: readonly PoolEvent[];
  readonly relayStates: Readonly<Record<string, ProgressiveRelaySnapshot>>;
  readonly cacheReady: boolean;
  readonly final: boolean;
  readonly status: ProgressiveReadStatus;
};

export type ProgressiveReadEvidence =
  | { readonly type: 'cache-ready'; readonly events?: readonly PoolEvent[] }
  | { readonly type: 'relay-events'; readonly events: readonly PoolEvent[] }
  | {
      readonly type: 'relay-statuses';
      readonly statuses: readonly ReadPageRelayStatus[];
    }
  | { readonly type: 'timeout' }
  | { readonly type: 'cancel' }
  | {
      readonly type: 'finalize';
      readonly statuses: readonly ReadPageRelayStatus[];
    };
