import type { RelayReadRequest } from '../events/types';
import type { PoolEvent } from './relay-pool';
import { readStatuses, type ReadPageResult } from './read-page-status';
import type { ProgressiveReadSnapshot } from './progressive-read-types';
import type { RelaySnapshot } from './types';

export function readPageResult(input: {
  readonly request: RelayReadRequest;
  readonly subId: string;
  readonly events: readonly PoolEvent[];
  readonly snapshots: readonly RelaySnapshot[];
  readonly timedOut: boolean;
  readonly aborted: boolean;
  readonly eventLimitReached: boolean;
  readonly startedAt: number;
  readonly snapshot?: ProgressiveReadSnapshot;
}): ReadPageResult {
  return {
    events: [...input.events],
    statuses: readStatuses({
      relays: input.request.relays,
      subId: input.subId,
      events: input.events,
      snapshots: input.snapshots,
      timedOut: input.timedOut,
      aborted: input.aborted,
      eventLimitReached: input.eventLimitReached,
      durationMs: Date.now() - input.startedAt,
    }),
    snapshot: input.snapshot,
  };
}
