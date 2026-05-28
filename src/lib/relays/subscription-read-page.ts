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
  defaultReadPageMaxEvents,
  relayFacingSubId,
  subscriptionKey,
  type ReadPageOptions,
} from './subscription-manager';
import {
  leaseRelayReadSubId,
  releaseRelayReadSubId,
  type RelayReadLeaseState,
} from './relay-read-leases';
import { requestSubscriptionDescriptor } from './subscription-descriptor';

export type ReadPageState = RelayReadLeaseState;

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
  const maxEvents = Math.max(1, options.maxEvents ?? defaultReadPageMaxEvents);
  let timedOut = false;
  let aborted = false;
  let eventLimitReached = false;
  let lastSnapshots: RelaySnapshot[] = [];
  const startedAt = Date.now();
  const requestKey = subscriptionKey(effective);
  const baseSubId = relayFacingSubId(effective.key);
  const subId = leaseRelayReadSubId(state, baseSubId, requestKey);
  let release: () => void = () => undefined;
  let offEvent: () => void = () => undefined;
  let offState: () => void = () => undefined;
  let close: () => void = () => undefined;
  let finishRead: (() => void) | undefined;
  let closedSubscription = false;
  const closeOnce = () => {
    if (closedSubscription) return;
    closedSubscription = true;
    close();
  };
  try {
    try {
      release = await readLimiter.acquire(
        limitedReadRelays(relays),
        options.signal,
      );
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error;
      aborted = true;
      return readResult(
        effective,
        subId,
        events,
        lastSnapshots,
        timedOut,
        aborted,
        eventLimitReached,
        startedAt,
      );
    }
    offEvent = pool.onEvent((event) => {
      if (event.subId !== subId || eventLimitReached) return;
      events.push({ ...event, subId: effective.key });
      if (events.length < maxEvents) return;
      eventLimitReached = true;
      finishRead?.();
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
      finishRead = () => finish(false);
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
        close = pool.subscribe(relays, subId, effective.filters, {
          purpose: effective.purpose,
          strategy: 'backward',
          idleCloseMs: options.timeoutMs ?? 5000,
          descriptor: requestSubscriptionDescriptor(effective),
        });
      }
    });
    finishRead = undefined;
    return readResult(
      effective,
      subId,
      events,
      lastSnapshots,
      timedOut,
      aborted,
      eventLimitReached,
      startedAt,
    );
  } finally {
    finishRead = undefined;
    offEvent();
    closeOnce();
    releaseRelayReadSubId(state, subId);
    release();
  }
}

function readResult(
  request: RelayReadRequest,
  subId: string,
  events: readonly PoolEvent[],
  snapshots: readonly RelaySnapshot[],
  timedOut: boolean,
  aborted: boolean,
  eventLimitReached: boolean,
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
      eventLimitReached,
      durationMs: Date.now() - startedAt,
    }),
  };
}
