import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import type { RelayDiagnostic, RelaySnapshot } from './types';

export type RelayDiagnosticSummary = {
  readonly relayUrl: string;
  readonly updatedAt: number;
  readonly attemptCount: number;
  readonly openCount: number;
  readonly errorCount: number;
  readonly lastConnectionAt?: number;
  readonly lastMessageAt?: number;
  readonly lastEventAt?: number;
  readonly lastEventId?: string;
  readonly lastError?: string;
  readonly firstMessageLatencyMs?: number;
  readonly eoseLatencyMs?: number;
  readonly validEventCount: number;
  readonly invalidEventCount: number;
  readonly invalidSubscriptionCount: number;
  readonly recentDiagnostics: readonly RelayDiagnostic[];
};

export type RelayDiagnosticEvidence = {
  readonly attempted?: boolean;
  readonly opened?: boolean;
  readonly errored?: boolean;
};

const memorySummaries = new Map<string, RelayDiagnosticSummary>();

export async function recordRelayDiagnosticSummary(
  snapshot: RelaySnapshot,
  evidence: RelayDiagnosticEvidence = {},
): Promise<RelayDiagnosticSummary> {
  const existing = await relayDiagnosticSummary(snapshot.url);
  const next = mergeSummary(snapshot, existing, evidence);
  memorySummaries.set(next.relayUrl, next);
  await bestEffortStorageWrite(() =>
    browserDb().relayDiagnosticSummaries.put(next),
  );
  return next;
}

export async function listRelayDiagnosticSummaries(): Promise<
  RelayDiagnosticSummary[]
> {
  const records = await boundedStorageRead(
    () => browserDb().relayDiagnosticSummaries.toArray(),
    [...memorySummaries.values()],
  );
  return records.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function clearRelayDiagnosticSummariesForTests(): void {
  memorySummaries.clear();
}

async function relayDiagnosticSummary(
  relayUrl: string,
): Promise<RelayDiagnosticSummary | undefined> {
  return (
    memorySummaries.get(relayUrl) ??
    (await boundedStorageRead(
      () => browserDb().relayDiagnosticSummaries.get(relayUrl),
      undefined,
    ))
  );
}

function mergeSummary(
  snapshot: RelaySnapshot,
  existing: RelayDiagnosticSummary | undefined,
  evidence: RelayDiagnosticEvidence,
): RelayDiagnosticSummary {
  return {
    relayUrl: snapshot.url,
    updatedAt: Date.now(),
    attemptCount: (existing?.attemptCount ?? 0) + (evidence.attempted ? 1 : 0),
    openCount: (existing?.openCount ?? 0) + (evidence.opened ? 1 : 0),
    errorCount: (existing?.errorCount ?? 0) + (evidence.errored ? 1 : 0),
    lastConnectionAt: snapshot.openedAt ?? existing?.lastConnectionAt,
    lastMessageAt: snapshot.lastMessageAt ?? existing?.lastMessageAt,
    lastEventAt: snapshot.lastEventAt ?? existing?.lastEventAt,
    lastEventId: snapshot.lastEventId ?? existing?.lastEventId,
    lastError: snapshot.lastError ?? existing?.lastError,
    firstMessageLatencyMs:
      snapshot.firstMessageLatencyMs ?? existing?.firstMessageLatencyMs,
    eoseLatencyMs: snapshot.eoseLatencyMs ?? existing?.eoseLatencyMs,
    validEventCount: Math.max(
      existing?.validEventCount ?? 0,
      snapshot.validation.validEventCount,
    ),
    invalidEventCount: Math.max(
      existing?.invalidEventCount ?? 0,
      snapshot.validation.invalidEventCount,
    ),
    invalidSubscriptionCount: Math.max(
      existing?.invalidSubscriptionCount ?? 0,
      snapshot.validation.invalidSubscriptionCount,
    ),
    recentDiagnostics: mergeDiagnostics(
      existing?.recentDiagnostics ?? [],
      snapshot.diagnostics,
    ),
  };
}

function mergeDiagnostics(
  a: readonly RelayDiagnostic[],
  b: readonly RelayDiagnostic[],
): RelayDiagnostic[] {
  const key = (item: RelayDiagnostic) =>
    `${item.timestamp}:${item.relay}:${item.subId ?? ''}:${item.kind}:${item.message}`;
  const byKey = new Map<string, RelayDiagnostic>();
  for (const item of [...a, ...b]) byKey.set(key(item), item);
  return [...byKey.values()]
    .sort((x, y) => x.timestamp - y.timestamp)
    .slice(-20);
}
