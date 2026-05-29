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
import type { RelayGroupPageRequest } from './relay-page';

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
        const hints = await hintsForScan({
          scanKey: request.key,
          relays: batch.relays,
          groupKey: group.key,
          filterKey: semanticFilterKey(filter),
          direction,
        });
        if (!coversRelays(hints, batch.relays)) {
          countRuntime('timeline', 'warmHintFallbacks');
          return relaySegmentInitialSpan;
        }
        spans.push(
          chooseWarmSpan({
            defaultSpanSeconds: relaySegmentInitialSpan,
            hints,
          }),
        );
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
  if (input.feedback === 'incomplete') return;
  const direction = input.request.direction ?? 'older';
  for (const relayUrl of input.relays)
    for (const filter of input.filters)
      void saveFeedScanHint({
        scanKey: input.request.key,
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

function coversRelays(
  hints: readonly Pick<FeedScanHint, 'relayUrl'>[],
  relays: readonly string[],
): boolean {
  const hinted = new Set(hints.map((hint) => hint.relayUrl));
  return relays.every((relay) => hinted.has(relay));
}
