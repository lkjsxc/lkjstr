import type { RelayReadRequest } from '../events/types';

export const defaultReadPageMaxEvents = 1000;

export type ReadPageOptions = {
  readonly timeoutMs?: number;
  readonly maxEvents?: number;
  readonly signal?: AbortSignal;
};

export type RelaySubscriptionManagerOptions = {
  readonly maxConcurrentReadPagesPerRelay?: number;
};

export type { RelayReadRequest };
