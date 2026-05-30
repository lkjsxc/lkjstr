import { countRuntime } from '../app/runtime-counters';
import { createBoundedMap } from '../fp/bounded-map';
import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import {
  relaySegmentMaxSpan,
  relaySegmentMinSpan,
} from './relay-page-segments';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import { feedScanHintLedgerRecord } from './feed-cache-ledger';

export type FeedScanHintFeedback =
  | 'limit-hit'
  | 'under-half'
  | 'balanced'
  | 'incomplete';

export type FeedScanHint = {
  readonly id: string;
  readonly scanKey: string;
  readonly relayUrl: string;
  readonly groupKey: string;
  readonly filterKey: string;
  readonly direction: 'older' | 'newer' | 'initial';
  readonly recommendedSpanSeconds: number;
  readonly lastSpanSeconds: number;
  readonly lastFeedback: FeedScanHintFeedback;
  readonly updatedAt: number;
};

export const feedScanHintMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
export const feedScanHintMaxRows = 2000;

const memoryHints = createBoundedMap<string, FeedScanHint>({
  maxSize: feedScanHintMaxRows,
});

export function scanHintKey(input: {
  readonly surfaceKey: string;
  readonly groupKey: string;
  readonly filterKey: string;
  readonly direction: string;
}): string {
  return [
    input.surfaceKey,
    input.groupKey,
    input.filterKey,
    input.direction,
  ].join('|');
}

export async function saveFeedScanHint(
  input: Omit<FeedScanHint, 'id' | 'updatedAt'>,
): Promise<void> {
  const hint = {
    ...input,
    id: hintId(input),
    recommendedSpanSeconds: clampSpan(input.recommendedSpanSeconds),
    lastSpanSeconds: clampSpan(input.lastSpanSeconds),
    updatedAt: Date.now(),
  };
  memoryHints.set(hint.id, hint);
  countRuntime('timeline', 'warmHintWrites');
  await bestEffortStorageWrite(() =>
    browserDb().transaction(
      'rw',
      browserDb().feedScanHints,
      browserDb().cacheLedger,
      async () => {
        await browserDb().feedScanHints.put(hint);
        await browserDb().cacheLedger.put(feedScanHintLedgerRecord(hint));
      },
    ),
  );
}

export async function hintsForScan(input: {
  readonly scanKey: string;
  readonly relays: readonly string[];
  readonly groupKey: string;
  readonly filterKey: string;
  readonly direction: FeedScanHint['direction'];
}): Promise<FeedScanHint[]> {
  const relays = new Set(input.relays);
  const rows = await boundedStorageRead(
    () =>
      browserDb()
        .feedScanHints.where('[scanKey+direction]')
        .equals([input.scanKey, input.direction])
        .toArray(),
    [...memoryHints.values()].filter((hint) => hint.scanKey === input.scanKey),
  );
  countRuntime('timeline', 'warmHintReads');
  return rows
    .filter((hint) => hint.groupKey === input.groupKey)
    .filter((hint) => hint.filterKey === input.filterKey)
    .filter((hint) => hint.direction === input.direction)
    .filter((hint) => relays.has(hint.relayUrl))
    .filter((hint) => !stale(hint))
    .map((hint) => ({
      ...hint,
      recommendedSpanSeconds: clampSpan(hint.recommendedSpanSeconds),
      lastSpanSeconds: clampSpan(hint.lastSpanSeconds),
    }));
}

export function chooseWarmSpan(input: {
  readonly defaultSpanSeconds: number;
  readonly hints: readonly FeedScanHint[];
}): number {
  if (input.hints.length === 0) return input.defaultSpanSeconds;
  return clampSpan(
    Math.min(...input.hints.map((hint) => hint.recommendedSpanSeconds)),
  );
}

export function recommendedSpanForFeedback(input: {
  readonly currentSpanSeconds: number;
  readonly feedback: FeedScanHintFeedback;
}): number {
  const current = clampSpan(input.currentSpanSeconds);
  if (input.feedback === 'under-half') return clampSpan(current * 2);
  if (input.feedback === 'limit-hit')
    return clampSpan(Math.max(relaySegmentMinSpan, Math.floor(current / 2)));
  return current;
}

export async function compactFeedScanHints(): Promise<void> {
  const fresh = newestFresh([...memoryHints.values()]);
  memoryHints.clear();
  for (const hint of fresh) memoryHints.set(hint.id, hint);
  await bestEffortStorageWrite(async () => {
    const rows = await browserDb().feedScanHints.toArray();
    const keep = new Set(newestFresh(rows).map((hint) => hint.id));
    const remove = rows
      .filter((hint) => !keep.has(hint.id))
      .map((hint) => hint.id);
    if (remove.length > 0) {
      await browserDb().feedScanHints.bulkDelete(remove);
      await browserDb().cacheLedger.bulkDelete(
        remove.map((id) => cacheLedgerId('feed-scan-hint', id)),
      );
    }
  });
}

export function clearFeedScanHintsForTests(): void {
  memoryHints.clear();
}

export function putFeedScanHintForTests(hint: FeedScanHint): void {
  memoryHints.set(hint.id, hint);
}

function newestFresh(hints: readonly FeedScanHint[]): FeedScanHint[] {
  return hints
    .filter((hint) => !stale(hint))
    .toSorted((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, feedScanHintMaxRows);
}

function hintId(input: Omit<FeedScanHint, 'id' | 'updatedAt'>): string {
  return [
    scanHintKey({
      surfaceKey: input.scanKey,
      groupKey: input.groupKey,
      filterKey: input.filterKey,
      direction: input.direction,
    }),
    input.relayUrl,
  ].join('|');
}

function stale(hint: FeedScanHint): boolean {
  return Date.now() - hint.updatedAt > feedScanHintMaxAgeMs;
}

function clampSpan(value: number): number {
  return Math.min(relaySegmentMaxSpan, Math.max(relaySegmentMinSpan, value));
}
