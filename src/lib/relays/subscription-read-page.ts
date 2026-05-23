import type { RelayReadRequest } from '../events/types';
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
  usedReadRequestKeys: Set<string>;
  usedReadBaseIds: Set<string>;
};

export async function executeReadPage(
  pool: RelayPool,
  readLimiter: PerRelayReadLimiter,
  state: ReadPageState,
  request: RelayReadRequest,
  options: ReadPageOptions,
): Promise<ReadPageResult> {
  const relays = compatibleRelayList(
    request.relays,
    request.filters,
    request.purpose,
  );
  if (relays.length === 0) return { events: [], statuses: [] };
  const effective = { ...request, relays };
  const events: PoolEvent[] = [];
  let timedOut = false;
  let lastSnapshots: RelaySnapshot[] = [];
  const startedAt = Date.now();
  const requestKey = subscriptionKey(effective);
  const baseSubId = relayFacingSubId(effective.key);
  const subId = nextSubId(state, baseSubId, requestKey);
  state.activeReadBaseIds.add(baseSubId);
  const release = await readLimiter.acquire(limitedReadRelays(relays));
  let offEvent: () => void = () => undefined;
  let offState: () => void = () => undefined;
  let close: () => void = () => undefined;
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
        offState();
        resolve();
      };
      const timer = setTimeout(() => finish(true), options.timeoutMs ?? 5000);
      offState = pool.onState((snapshots) => {
        lastSnapshots = snapshots;
        if (readPageComplete(snapshots, relays, subId)) finish();
      });
      if (!done)
        close = pool.subscribe(relays, subId, request.filters, request.purpose);
    });
    return readResult(
      effective,
      subId,
      events,
      lastSnapshots,
      timedOut,
      startedAt,
    );
  } finally {
    offEvent();
    close();
    state.activeReadBaseIds.delete(baseSubId);
    state.usedReadRequestKeys.add(requestKey);
    state.usedReadBaseIds.add(baseSubId);
    release();
  }
}

function nextSubId(
  state: ReadPageState,
  baseSubId: string,
  requestKey: string,
): string {
  if (
    !state.activeReadBaseIds.has(baseSubId) &&
    !state.usedReadBaseIds.has(baseSubId) &&
    !state.usedReadRequestKeys.has(requestKey)
  )
    return baseSubId;
  state.readSeq += 1;
  return relayFacingSubId(`${requestKey}:${state.readSeq}`);
}

function readResult(
  request: RelayReadRequest,
  subId: string,
  events: readonly PoolEvent[],
  snapshots: readonly RelaySnapshot[],
  timedOut: boolean,
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
      durationMs: Date.now() - startedAt,
    }),
  };
}
