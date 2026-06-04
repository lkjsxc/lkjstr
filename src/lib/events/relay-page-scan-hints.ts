import { countRuntime } from '../app/runtime-counters';
import type { NostrFilter } from '../protocol';
import {
  chooseWarmSpan,
  hintsForScan,
  recommendedSpanForFeedback,
  saveFeedScanHint,
  type FeedScanHint,
  type FeedScanHintFeedback,
} from './feed-scan-hints';
import { positiveFilters } from './relay-page-filter';
import { limitedRelayFilterGroups } from './relay-page-limits';
import { semanticFilterKey } from './relay-page-scan-diagnostics';
import { relaySegmentInitialSpan } from './relay-page-segments';
import type { BatchReadResult } from './relay-page-scan-batch';
import {
  scanContextForRelay,
  scanEdge,
  scanSemanticKey,
} from './relay-page-scan-context';
import type { RelayGroupPageRequest } from './relay-page';
import {
  insertScanDecisionTrace,
  selectScanModelsForContext,
} from '$lib/feed-surface/scan-model-repository';
import {
  proposeScanSpanFromModels,
  type ScanSpanProposal,
} from '$lib/feed-surface/scan-model-learning';
import { planScanSpanWithRust } from '$lib/feed-surface/scan-model-bridge';
import type { ScanModelContext } from '$lib/feed-surface/scan-model-records';

export async function warmInitialSpan(
  request: RelayGroupPageRequest,
  direction: FeedScanHint['direction'],
): Promise<number> {
  const spans: number[] = [];
  for (const group of request.groups) {
    const filters = positiveFilters(
      request.filters(group, {}),
      request.pageSize,
    );
    const batches = await limitedRelayFilterGroups(
      group.relays,
      filters,
      request.pageSize,
    );
    for (const batch of batches) {
      for (const filter of batch.filters) {
        const filterKey = semanticFilterKey(filter);
        const hints = await hintsForScan({
          scanKey: scanSemanticKey(request),
          relays: batch.relays,
          groupKey: group.key,
          filterKey,
          direction,
        });
        for (const relayUrl of batch.relays) {
          const span = await warmSpanForRelay({
            request,
            groupKey: group.key,
            relayUrl,
            filterKey,
            direction,
            effectiveLimit: filter.limit ?? request.pageSize,
            previousSpanSeconds: hints.find(
              (hint) => hint.relayUrl === relayUrl,
            )?.recommendedSpanSeconds,
          });
          if (
            span === undefined &&
            !hints.some((hint) => hint.relayUrl === relayUrl)
          ) {
            countRuntime('timeline', 'warmHintFallbacks');
            return relaySegmentInitialSpan;
          }
          spans.push(
            span ??
              chooseWarmSpan({
                defaultSpanSeconds: relaySegmentInitialSpan,
                hints,
              }),
          );
        }
      }
    }
  }
  return spans.length === 0 ? relaySegmentInitialSpan : Math.min(...spans);
}

export function recordBatchHints(input: {
  readonly request: RelayGroupPageRequest;
  readonly groupKey: string;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly read: BatchReadResult;
  readonly spanSeconds: number;
  readonly feedback: FeedScanHintFeedback;
}): void {
  if (input.request.purpose && input.request.purpose !== 'feed') return;
  if (input.feedback === 'incomplete') return;
  const direction = input.request.direction ?? 'older';
  for (const relayUrl of input.relays)
    for (const filter of input.filters)
      void saveFeedScanHint({
        scanKey: scanSemanticKey(input.request),
        relayUrl,
        groupKey: input.groupKey,
        filterKey: semanticFilterKey(filter),
        direction,
        recommendedSpanSeconds: recommendedSpanForFeedback({
          currentSpanSeconds: input.spanSeconds,
          feedback: input.feedback,
        }),
        lastSpanSeconds: input.spanSeconds,
        lastFeedback: input.feedback,
      });
}

async function warmSpanForRelay(input: {
  readonly request: RelayGroupPageRequest;
  readonly groupKey: string;
  readonly relayUrl: string;
  readonly filterKey: string;
  readonly direction: FeedScanHint['direction'];
  readonly effectiveLimit: number;
  readonly previousSpanSeconds?: number;
}): Promise<number | undefined> {
  if (input.direction === 'initial') return undefined;
  const context = scanContextForRelay({ ...input, direction: input.direction });
  const models = await selectScanModelsForContext(context);
  if (!models || models.length === 0) return undefined;
  const nowMs = Date.now();
  const edge = scanEdge({
    request: input.request,
    direction: input.direction,
    nowMs,
  });
  const bridgePlan = {
    context,
    models,
    effectiveLimit: input.effectiveLimit,
    requestedLimit: input.effectiveLimit,
    pageSize: input.request.pageSize,
    previousSpanSeconds: input.previousSpanSeconds,
    nowMs,
    ...edge,
  };
  const rust = await planScanSpanWithRust(bridgePlan);
  if (rust.ok) {
    void recordDecisionTrace(context, rust.value.proposal, {
      bridge: 'rust-wasm',
      raw: rust.value.raw,
    });
    return rust.value.proposal.spanSeconds;
  }
  const proposal = proposeScanSpanFromModels({
    context,
    models,
    effectiveLimit: input.effectiveLimit,
    previousSpanSeconds: input.previousSpanSeconds,
    nowMs,
  });
  if (!proposal) return undefined;
  void recordDecisionTrace(context, proposal, {
    bridge: 'typescript-fallback',
    unavailableMessage: rust.message,
  });
  return proposal.spanSeconds;
}

async function recordDecisionTrace(
  context: ScanModelContext,
  proposal: ScanSpanProposal,
  bridge: {
    readonly bridge: 'rust-wasm' | 'typescript-fallback';
    readonly raw?: unknown;
    readonly unavailableMessage?: string;
  },
): Promise<void> {
  const createdAtMs = Date.now();
  await insertScanDecisionTrace({
    traceId: `scan:${createdAtMs}:${Math.random().toString(36).slice(2)}`,
    modelKey: proposal.sourceModelKey,
    semanticFeedKey: context.semanticFeedKey,
    direction: context.direction,
    createdAtMs,
    recordJson: { context, proposal, bridge },
  });
}
