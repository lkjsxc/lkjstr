import { normalizeRelayUrl, type NostrFilter } from '../protocol';
import { createBoundedMap } from '../fp/bounded-map';
import type { RelayReadRequest } from '../events/types';
import type { ReadPageRelayStatus } from './read-page-status';
import type { RelaySubscriptionDescriptorInput } from './types';
import type {
  RelayReadScore,
  RelayReadScoreContext,
  RelayReadScoreInput,
  RelayReadScoreKey,
  RelayReadScoreStore,
} from './relay-read-score-types';
import {
  compareRelayReadScores,
  initialRelayReadScore,
  updateRelayReadScore,
} from './relay-read-score-model';
export type {
  RelayReadScore,
  RelayReadScoreContext,
  RelayReadScoreInput,
  RelayReadScoreKey,
  RelayReadScoreStore,
} from './relay-read-score-types';
export {
  compareRelayReadScores,
  initialRelayReadScore,
  updateRelayReadScore,
} from './relay-read-score-model';

const scores = createBoundedMap<string, RelayReadScore>({
  maxSize: 2000,
  ttlMs: 7 * 24 * 60 * 60 * 1000,
});

export const defaultRelayReadScoreStore: RelayReadScoreStore = {
  get: (key) => scores.get(scoreKeyId(key)),
  set: (score) => scores.set(scoreKeyId(score.key), score),
};

export function relayReadScoreSnapshot(): RelayReadScore[] {
  return scores.values().toSorted(compareRelayReadScores).slice(0, 50);
}

export function relayReadScoreContext(
  request: RelayReadRequest,
  descriptor: RelaySubscriptionDescriptorInput,
): RelayReadScoreContext {
  return {
    surface: descriptor.surface ?? 'unknown',
    phase: descriptor.phase ?? 'page',
    direction: request.key.includes('newer') ? 'newer' : 'older',
    routeGroupKey: 'default',
    filterShape: filterShape(request.filters),
    purpose: request.purpose ?? descriptor.purpose ?? 'feed',
  };
}

export function scoreRelayCandidates(
  relays: readonly string[],
  context: RelayReadScoreContext,
  store: RelayReadScoreStore = defaultRelayReadScoreStore,
): string[] {
  return normalizedRelays(relays)
    .map((relayUrl) => {
      const key = { ...context, relayUrl };
      return store.get(key) ?? initialRelayReadScore(key);
    })
    .sort(compareRelayReadScores)
    .map((score) => score.key.relayUrl);
}

export function recordRelayReadStatuses(
  context: RelayReadScoreContext,
  statuses: readonly ReadPageRelayStatus[],
  store: RelayReadScoreStore = defaultRelayReadScoreStore,
): void {
  const updatedAt = Date.now();
  for (const status of statuses) {
    const relayUrl = normalizeRelayUrl(status.relay);
    if (!relayUrl) continue;
    const key = { ...context, relayUrl };
    const previous = store.get(key) ?? initialRelayReadScore(key);
    store.set(updateRelayReadScore(previous, observation(status, updatedAt)));
  }
}

function observation(
  status: ReadPageRelayStatus,
  updatedAt: number,
): RelayReadScoreInput {
  const startedAtMs = Math.max(0, updatedAt - status.durationMs);
  return {
    startedAtMs,
    firstEventMs:
      status.candidateCount > 0 ? startedAtMs + status.durationMs : undefined,
    eoseMs: status.eose ? startedAtMs + status.durationMs : undefined,
    durationMs: status.durationMs,
    eventCount: status.candidateCount,
    uniqueEventCount: status.candidateCount,
    finalCount: status.finalCount,
    timeout: status.timeout,
    closed: status.closed || status.socketClosed,
    auth: status.auth,
    socketError: status.socketError,
    eventLimitReached: status.eventLimitReached,
    bytesSent: 0,
    bytesReceived: 0,
    updatedAt,
  };
}

function normalizedRelays(relays: readonly string[]): string[] {
  return [
    ...new Set(
      relays
        .map(normalizeRelayUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ].sort();
}

function filterShape(filters: readonly NostrFilter[]): string {
  return JSON.stringify(filters.map((filter) => normalizeFilter(filter)));
}

function normalizeFilter(filter: NostrFilter): NostrFilter {
  return Object.fromEntries(
    Object.entries(filter).sort(([left], [right]) => left.localeCompare(right)),
  ) as NostrFilter;
}

function scoreKeyId(key: RelayReadScoreKey): string {
  return JSON.stringify(key);
}
