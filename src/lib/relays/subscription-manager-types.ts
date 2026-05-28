import type { RelayReadRequest } from '../events/types';
import type { OnProgressiveReadSnapshot } from './progressive-read-types';

export const defaultReadPageMaxEvents = 1000;

export type ReadPageOptions = {
  readonly timeoutMs?: number;
  readonly maxEvents?: number;
  readonly signal?: AbortSignal;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
};

export type RelaySubscriptionManagerOptions = {
  readonly maxConcurrentReadPagesPerRelay?: number;
};

export type { RelayReadRequest };
