import { setMemoryCounter } from '../app/memory-counters';
import { browserDb } from '../storage/browser-db';
import { createBoundedMap } from '../fp/bounded-map';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import { mergeRelayDiagnosticSummary } from './relay-diagnostic-merge';
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

const diagnosticSummaryCap = 250;
const idbListLimit = 250;
const pendingWriteCap = 250;

const memorySummaries = createBoundedMap<string, RelayDiagnosticSummary>({
  maxSize: diagnosticSummaryCap,
});

const pendingWrites = new Map<string, RelayDiagnosticSummary>();
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const writeThrottleMs = 5000;

function syncDiagnosticCounter(): void {
  setMemoryCounter('relay-diagnostic-summary-count', memorySummaries.size());
}

function capPendingWrites(): void {
  while (pendingWrites.size > pendingWriteCap) {
    const oldest = pendingWrites.keys().next().value;
    if (!oldest) break;
    pendingWrites.delete(oldest);
    const timer = writeTimers.get(oldest);
    if (timer) clearTimeout(timer);
    writeTimers.delete(oldest);
  }
}

export async function recordRelayDiagnosticSummary(
  snapshot: RelaySnapshot,
  evidence: RelayDiagnosticEvidence = {},
): Promise<RelayDiagnosticSummary> {
  const existing = await relayDiagnosticSummary(snapshot.url);
  const next = mergeRelayDiagnosticSummary(snapshot, existing, evidence);
  memorySummaries.set(next.relayUrl, next);
  syncDiagnosticCounter();
  scheduleWrite(next);
  return next;
}

function scheduleWrite(summary: RelayDiagnosticSummary): void {
  const relayUrl = summary.relayUrl;
  pendingWrites.set(relayUrl, summary);
  capPendingWrites();
  const existing = writeTimers.get(relayUrl);
  if (existing) clearTimeout(existing);
  writeTimers.set(
    relayUrl,
    setTimeout(() => flushWrite(relayUrl), writeThrottleMs),
  );
}

async function flushWrite(relayUrl: string): Promise<void> {
  writeTimers.delete(relayUrl);
  const summary = pendingWrites.get(relayUrl);
  if (!summary) return;
  pendingWrites.delete(relayUrl);
  await bestEffortStorageWrite(() =>
    browserDb().relayDiagnosticSummaries.put(summary),
  );
}

export async function listRelayDiagnosticSummaries(): Promise<
  RelayDiagnosticSummary[]
> {
  await flushAllPendingWrites();
  const records = await boundedStorageRead(
    () =>
      browserDb()
        .relayDiagnosticSummaries.orderBy('updatedAt')
        .reverse()
        .limit(idbListLimit)
        .toArray(),
    [...memorySummaries.values()],
  );
  return records.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function clearRelayDiagnosticSummariesForTests(): void {
  memorySummaries.clear();
  pendingWrites.clear();
  for (const timer of writeTimers.values()) clearTimeout(timer);
  writeTimers.clear();
  syncDiagnosticCounter();
}

export function relayDiagnosticSummaryMemorySize(): number {
  return memorySummaries.size();
}

export function relayDiagnosticSummaryMemorySizeForTests(): number {
  return relayDiagnosticSummaryMemorySize();
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

async function flushAllPendingWrites(): Promise<void> {
  const urls = [...pendingWrites.keys()];
  if (urls.length === 0) return;
  const batch = urls
    .map((url) => pendingWrites.get(url))
    .filter(Boolean) as RelayDiagnosticSummary[];
  for (const url of urls) {
    writeTimers.delete(url);
    pendingWrites.delete(url);
  }
  await bestEffortStorageWrite(() =>
    browserDb().relayDiagnosticSummaries.bulkPut(batch),
  );
}
