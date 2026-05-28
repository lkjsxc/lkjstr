import { mergeProgressiveEvents } from './progressive-read-provenance';
import {
  progressiveStatus,
  relaySnapshotFromStatus,
} from './progressive-read-selectors';
import type { ReadPageRelayStatus } from './read-page-status';
import type {
  ProgressiveReadEvidence,
  ProgressiveReadSnapshot,
  ProgressiveReadState,
  ProgressiveRelaySnapshot,
} from './progressive-read-types';

export function initialProgressiveRead(input: {
  readonly readId: string;
  readonly surface?: string;
  readonly relays: readonly string[];
  readonly startedAt?: number;
}): ProgressiveReadState {
  const relayStates: Record<string, ProgressiveRelaySnapshot> = {};
  for (const relay of input.relays) {
    relayStates[relay] = {
      relay,
      state: 'pending',
      eventCount: 0,
      finalCount: 0,
    };
  }
  const state = {
    readId: input.readId,
    surface: input.surface,
    startedAt: input.startedAt ?? Date.now(),
    relays: [...input.relays],
    events: [],
    relayStates,
    cacheReady: false,
    final: false,
    status: 'idle' as const,
  };
  return { ...state, status: progressiveStatus(state) };
}

export function reduceProgressiveRead(
  state: ProgressiveReadState,
  evidence: ProgressiveReadEvidence,
): ProgressiveReadState {
  const base = applyEvidence(state, evidence);
  return { ...base, status: progressiveStatus(base) };
}

export function progressiveReadSnapshot(
  state: ProgressiveReadState,
  reason: string,
  now = Date.now(),
): ProgressiveReadSnapshot {
  return {
    readId: state.readId,
    surface: state.surface,
    status: state.status,
    reason,
    events: state.events,
    relays: state.relays.map((relay) => state.relayStates[relay]!),
    startedAt: state.startedAt,
    updatedAt: now,
    durationMs: Math.max(0, now - state.startedAt),
    final: state.final,
  };
}

function applyEvidence(
  state: ProgressiveReadState,
  evidence: ProgressiveReadEvidence,
): ProgressiveReadState {
  if (state.status === 'cancelled') return state;
  if (evidence.type === 'cache-ready')
    return {
      ...state,
      cacheReady: true,
      events: mergeProgressiveEvents(state.events, evidence.events ?? []),
    };
  if (evidence.type === 'relay-events')
    return {
      ...state,
      events: mergeProgressiveEvents(state.events, evidence.events),
    };
  if (evidence.type === 'cancel')
    return { ...state, final: true, relayStates: cancelRelays(state) };
  if (evidence.type === 'timeout')
    return { ...state, final: true, relayStates: timeoutRelays(state) };
  return {
    ...state,
    final: evidence.type === 'finalize',
    relayStates: mergeRelayStatuses(state, evidence.statuses),
  };
}

function mergeRelayStatuses(
  state: ProgressiveReadState,
  statuses: readonly ReadPageRelayStatus[],
): Record<string, ProgressiveRelaySnapshot> {
  const relayStates = { ...state.relayStates };
  for (const status of statuses) {
    relayStates[status.relay] = relaySnapshotFromStatus(status);
  }
  return relayStates;
}

function cancelRelays(
  state: ProgressiveReadState,
): Record<string, ProgressiveRelaySnapshot> {
  return Object.fromEntries(
    state.relays.map((relay) => [
      relay,
      {
        ...state.relayStates[relay]!,
        state: 'cancelled' as const,
        reason: 'cancelled',
      },
    ]),
  );
}

function timeoutRelays(
  state: ProgressiveReadState,
): Record<string, ProgressiveRelaySnapshot> {
  return Object.fromEntries(
    state.relays.map((relay) => {
      const current = state.relayStates[relay]!;
      return [
        relay,
        current.state === 'eose'
          ? current
          : { ...current, state: 'timeout' as const },
      ];
    }),
  );
}
