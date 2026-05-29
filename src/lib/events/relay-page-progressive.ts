import type { PoolEvent } from '../relays/relay-pool';
import { mergeProgressiveEvents } from '../relays/progressive-read-provenance';
import type {
  OnProgressiveReadSnapshot,
  ProgressiveReadSnapshot,
  ProgressiveReadStatus,
  ProgressiveRelaySnapshot,
} from '../relays/progressive-read-types';
import type { RelayGroupPageRequest, RelayGroupPageResult } from './relay-page';

type PageProgress = {
  readonly onBatchSnapshot: OnProgressiveReadSnapshot | undefined;
  readonly finish: (result: RelayGroupPageResult) => void;
};

export function relayPageProgressive(
  request: RelayGroupPageRequest,
): PageProgress {
  if (!request.onSnapshot)
    return { onBatchSnapshot: undefined, finish: () => undefined };
  let events: PoolEvent[] = [];
  const relays = new Map<string, ProgressiveRelaySnapshot>();
  const startedAt = Date.now();
  const publish = (
    reason: string,
    status: ProgressiveReadStatus,
    final: boolean,
  ) =>
    request.onSnapshot?.({
      readId: request.key,
      status,
      reason,
      events,
      relays: [...relays.values()].sort((a, b) =>
        a.relay.localeCompare(b.relay),
      ),
      startedAt,
      updatedAt: Date.now(),
      durationMs: Math.max(0, Date.now() - startedAt),
      final,
    });
  return {
    onBatchSnapshot: (snapshot) => {
      events = mergeProgressiveEvents(events, snapshot.events);
      for (const relay of snapshot.relays) relays.set(relay.relay, relay);
      publish(snapshot.reason, batchStatus(snapshot), false);
    },
    finish: (result) => {
      publish(
        result.incomplete ? 'grouped-page-incomplete' : 'grouped-page-complete',
        result.incomplete ? 'incomplete' : 'complete',
        true,
      );
    },
  };
}

function batchStatus(snapshot: ProgressiveReadSnapshot): ProgressiveReadStatus {
  if (snapshot.status === 'failed' || snapshot.status === 'cancelled')
    return snapshot.status;
  if (snapshot.events.length > 0) return 'partial';
  return snapshot.final ? 'partial' : snapshot.status;
}
