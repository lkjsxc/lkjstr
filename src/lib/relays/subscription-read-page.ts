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
import { createProgressiveReadPublisher } from './progressive-read-publisher';
import { readPageResult } from './subscription-read-result';

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
  const progressive = createProgressiveReadPublisher({
    readId: requestKey,
    surface: effective.purpose,
    relays,
    startedAt,
    onSnapshot: options.onSnapshot,
  });
  const statuses = () =>
    readStatuses({
      relays: effective.relays,
      subId,
      events,
      snapshots: lastSnapshots,
      timedOut,
      aborted,
      eventLimitReached,
      durationMs: Date.now() - startedAt,
    });
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
    progressive.emit('start');
    try {
      release = await readLimiter.acquire(
        limitedReadRelays(relays),
        options.signal,
      );
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error;
      aborted = true;
      progressive.apply({ type: 'cancel' }, 'cancel');
      return readPageResult({
        request: effective,
        subId,
        events,
        snapshots: lastSnapshots,
        timedOut,
        aborted,
        eventLimitReached,
        startedAt,
        snapshot: progressive.snapshot('final'),
      });
    }
    offEvent = pool.onEvent((event) => {
      if (event.subId !== subId || eventLimitReached) return;
      const received = { ...event, subId: effective.key };
      events.push(received);
      progressive.apply(
        { type: 'relay-events', events: [received] },
        'relay-events',
      );
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
          progressive.apply(
            { type: 'relay-statuses', statuses: statuses() },
            'relay-state',
          );
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
    progressive.apply(
      aborted ? { type: 'cancel' } : { type: 'finalize', statuses: statuses() },
      aborted ? 'cancel' : 'final',
    );
    return readPageResult({
      request: effective,
      subId,
      events,
      snapshots: lastSnapshots,
      timedOut,
      aborted,
      eventLimitReached,
      startedAt,
      snapshot: progressive.snapshot('final'),
    });
  } finally {
    finishRead = undefined;
    offEvent();
    closeOnce();
    releaseRelayReadSubId(state, subId);
    release();
  }
}
