import type { ReadPageRelayStatus } from './read-page-status';
import type {
  ProgressiveReadState,
  ProgressiveReadStatus,
  ProgressiveRelaySnapshot,
  ProgressiveRelayState,
} from './progressive-read-types';

export function progressiveStatus(
  state: ProgressiveReadState,
): ProgressiveReadStatus {
  const relays = Object.values(state.relayStates);
  if (relays.some((relay) => relay.state === 'cancelled')) return 'cancelled';
  if (state.final && relays.every((relay) => relay.state === 'eose'))
    return 'complete';
  if (
    state.final &&
    relays.some((relay) => ['timeout', 'closed', 'auth'].includes(relay.state))
  )
    return state.events.length > 0 ? 'incomplete' : 'failed';
  if (state.final && relays.some((relay) => relay.state === 'error'))
    return state.events.length > 0 ? 'incomplete' : 'failed';
  if (state.events.length > 0) return 'partial';
  if (state.cacheReady) return 'cache-ready';
  return 'idle';
}

export function relaySnapshotFromStatus(
  status: ReadPageRelayStatus,
): ProgressiveRelaySnapshot {
  return {
    relay: status.relay,
    state: relayStateFromStatus(status),
    eventCount: status.candidateCount,
    finalCount: status.finalCount,
    durationMs: status.durationMs,
    reason: relayReason(status),
  };
}

function relayStateFromStatus(
  status: ReadPageRelayStatus,
): ProgressiveRelayState {
  if (status.aborted) return 'cancelled';
  if (status.auth) return 'auth';
  if (status.closed || status.socketClosed) return 'closed';
  if (status.socketError) return 'error';
  if (status.timeout || status.eventLimitReached) return 'timeout';
  if (status.eose) return 'eose';
  if (status.candidateCount > 0) return 'reading';
  return 'connected';
}

function relayReason(status: ReadPageRelayStatus): string | undefined {
  if (status.aborted) return 'cancelled';
  if (status.auth) return 'auth';
  if (status.socketError) return 'socket-error';
  if (status.closed || status.socketClosed) return 'closed';
  if (status.eventLimitReached) return 'event-limit';
  if (status.timeout) return 'timeout';
  return undefined;
}
