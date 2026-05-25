import type { RelayDiagnostic, RelaySnapshot } from './types';
import type {
  RelayDiagnosticEvidence,
  RelayDiagnosticSummary,
} from './relay-diagnostic-summary';

export function mergeRelayDiagnosticSummary(
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
    recentDiagnostics: mergeRelayDiagnostics(
      existing?.recentDiagnostics ?? [],
      snapshot.diagnostics,
    ),
  };
}

function mergeRelayDiagnostics(
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
