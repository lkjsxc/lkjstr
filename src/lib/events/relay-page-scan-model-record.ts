import type { NostrFilter } from '../protocol';
import type { BatchReadResult } from './relay-page-scan-batch';
import { semanticFilterKey } from './relay-page-scan-diagnostics';
import type { RelayPageSegment } from './relay-page-segments';
import type { RelayGroupPageRequest } from './relay-page';
import {
  insertScanObservation,
  selectScanModelsForContext,
  upsertScanDensityModels,
} from '$lib/feed-surface/scan-model-repository';
import {
  updateScanModelsFromObservation,
  type ScanModelObservation,
} from '$lib/feed-surface/scan-model-learning';
import type { ScanModelContext } from '$lib/feed-surface/scan-model-records';

export async function recordBatchScanModels(input: {
  readonly request: RelayGroupPageRequest;
  readonly groupKey: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly read: BatchReadResult;
  readonly segment: RelayPageSegment;
}): Promise<void> {
  if (input.request.purpose && input.request.purpose !== 'feed') return;
  const direction = input.request.direction ?? 'older';
  if (direction === 'initial') return;
  for (const relayUrl of input.relays) {
    for (const filter of input.filters) {
      await recordOne({ ...input, relayUrl, filter, direction });
    }
  }
}

async function recordOne(input: {
  readonly request: RelayGroupPageRequest;
  readonly groupKey: string;
  readonly relayUrl: string;
  readonly filter: NostrFilter;
  readonly read: BatchReadResult;
  readonly segment: RelayPageSegment;
  readonly direction: 'older' | 'newer';
}): Promise<void> {
  const context = scanContext(input);
  const observation = scanObservation(input, context);
  const previousModels = (await selectScanModelsForContext(context)) ?? [];
  const models = updateScanModelsFromObservation({
    observation,
    previousModels,
  });
  await insertScanObservation({
    ...context,
    id: observationId(observation),
    createdAtMs: observation.completedAtMs,
    recordJson: observation,
  });
  await upsertScanDensityModels(models);
}

function scanObservation(
  input: Parameters<typeof recordOne>[0],
  context: ScanModelContext,
): ScanModelObservation {
  const completedAtMs = Date.now();
  const status = input.read.statuses.find((item) => item.relay === input.relayUrl);
  const density = input.read.density.perRelay.find(
    (item) => item.relay === input.relayUrl,
  );
  const eventCount = density?.eventCount ?? status?.candidateCount ?? 0;
  const uniqueEventCount = density?.uniqueCount ?? eventCount;
  const finalVisibleCount = density?.observedCount ?? status?.finalCount ?? eventCount;
  return {
    ...context,
    sinceSeconds: input.segment.since ?? 0,
    untilSeconds: input.segment.until ?? input.segment.since ?? 0,
    requestedLimit: input.filter.limit ?? input.request.pageSize,
    effectiveLimit: density?.limit ?? input.filter.limit ?? input.request.pageSize,
    eventCount,
    uniqueEventCount,
    finalVisibleCount,
    eventLimitReached: Boolean(status?.eventLimitReached || density?.hitLimit),
    eose: status?.eose ?? input.read.complete,
    timeout: status?.timeout ?? !input.read.complete,
    closed: Boolean(status?.closed || status?.socketClosed),
    auth: Boolean(status?.auth),
    socketError: Boolean(status?.socketError),
    startedAtMs: Math.max(0, completedAtMs - input.read.durationMs),
    completedAtMs,
  };
}

function scanContext(input: Parameters<typeof recordOne>[0]): ScanModelContext {
  return {
    semanticFeedKey: scanSemanticKey(input.request),
    routeGroupKey: input.groupKey,
    relayUrl: input.relayUrl,
    semanticFilterKey: semanticFilterKey(input.filter),
    direction: input.direction,
    routeFingerprint: input.request.routeFingerprint ?? input.request.key,
  };
}

function scanSemanticKey(request: RelayGroupPageRequest): string {
  return request.semanticFeedKey ?? request.key;
}

function observationId(observation: ScanModelObservation): string {
  return [
    observation.semanticFeedKey,
    observation.routeGroupKey,
    observation.relayUrl,
    observation.semanticFilterKey,
    observation.direction,
    observation.routeFingerprint,
    observation.sinceSeconds,
    observation.untilSeconds,
    observation.completedAtMs,
  ].join('|');
}
