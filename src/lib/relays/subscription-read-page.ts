import type { RelayReadRequest } from '../events/types';
import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import type { PoolEvent, RelayPool } from './relay-pool';
import {
  limitedReadRelays,
  type PerRelayReadLimiter,
  readPageComplete,
} from './read-limiter';
import { compatibleRelayList } from './relay-request-compat';
import { readStatuses, type ReadPageResult } from './read-page-status';
import type { RelaySnapshot } from './types';
import {
  relayFacingSubId,
  subscriptionKey,
  type ReadPageOptions,
} from './subscription-manager';

export type ReadPageState = {
  readSeq: number;
  activeReadBaseIds: Set<string>;
};

export async function executeReadPage(
  pool: RelayPool,
  readLimiter: PerRelayReadLimiter,
  state: ReadPageState,
  request: RelayReadRequest,
  options: ReadPageOptions,
): Promise<ReadPageResult> {
  const safeRequest = {
    ...request,
    filters: relaySafeFilters(request.filters),
  };
  const relays = compatibleRelayList(
    safeRequest.relays,
    safeRequest.filters,
    safeRequest.purpose,
  );
  if (relays.length === 0) return { events: [], statuses: [] };
  const effective = { ...safeRequest, relays };
  const events: PoolEvent[] = [];
  let timedOut = false;
  let aborted = false;
  let lastSnapshots: RelaySnapshot[] = [];
  const startedAt = Date.now();
  const requestKey = subscriptionKey(effective);
  const baseSubId = relayFacingSubId(effective.key);
  const subId = nextSubId(state, baseSubId, requestKey);
  const release = await readLimiter.acquire(limitedReadRelays(relays));
  let offEvent: () => void = () => undefined;
  let offState: () => void = () => undefined;
  let close: () => void = () => undefined;
  let closedSubscription = false;
  const closeOnce = () => {
    if (closedSubscription) return;
    closedSubscription = true;
    close();
  };
  try {
    offEvent = pool.onEvent((event) => {
      if (event.subId === subId)
        events.push({ ...event, subId: effective.key });
    });
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = (timeout = false) => {
        if (done) return;
        done = true;
        timedOut = timeout;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        offState();
        closeOnce();
        resolve();
      };
      const abort = () => {
        aborted = true;
        finish(false);
      };
      const timer = setTimeout(() => finish(true), options.timeoutMs ?? 5000);
      if (options.signal?.aborted) abort();
      else options.signal?.addEventListener('abort', abort, { once: true });
      if (!done) {
        offState = pool.onState((snapshots) => {
          lastSnapshots = snapshots;
          if (readPageComplete(snapshots, relays, subId)) finish();
        });
        close = pool.subscribe(
          relays,
          subId,
          effective.filters,
          effective.purpose,
        );
      }
    });
    return readResult(
      effective,
      subId,
      events,
      lastSnapshots,
      timedOut,
      aborted,
      startedAt,
    );
  } finally {
    offEvent();
    closeOnce();
    state.activeReadBaseIds.delete(baseSubId);
    release();
  }
}

function nextSubId(
  state: ReadPageState,
  baseSubId: string,
  requestKey: string,
): string {
  if (!state.activeReadBaseIds.has(baseSubId)) {
    state.activeReadBaseIds.add(baseSubId);
    return baseSubId;
  }
  state.readSeq += 1;
  return relayFacingSubId(`${requestKey}:${state.readSeq}`);
}

function readResult(
  request: RelayReadRequest,
  subId: string,
  events: readonly PoolEvent[],
  snapshots: readonly RelaySnapshot[],
  timedOut: boolean,
  aborted: boolean,
  startedAt: number,
): ReadPageResult {
  return {
    events: [...events],
    statuses: readStatuses({
      relays: request.relays,
      subId,
      events,
      snapshots,
      timedOut,
      aborted,
      durationMs: Date.now() - startedAt,
    }),
  };
}
