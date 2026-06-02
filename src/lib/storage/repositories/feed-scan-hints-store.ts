import { feedScanHintLedgerRecord } from '../../events/feed-cache-ledger';
import type { FeedScanHint } from '../../events/feed-scan-hints';
import {
  sqliteCompactFeedScanHints,
  sqliteDeleteAllFeedScanHints,
  sqlitePutFeedScanHint,
  sqliteReadFeedScanHints,
} from '../sqlite-opfs/feed-cache-sqlite';

export async function putFeedScanHintWithLedger(
  hint: FeedScanHint,
): Promise<void> {
  await sqlitePutFeedScanHint(hint, feedScanHintLedgerRecord(hint)).catch(
    () => false,
  );
}

export async function readFeedScanHintRowsForScan(
  input: {
    readonly scanKey: string;
    readonly direction: FeedScanHint['direction'];
  },
  fallback: readonly FeedScanHint[],
): Promise<FeedScanHint[]> {
  return (
    (await sqliteReadFeedScanHints(input).catch(() => undefined)) ?? [
      ...fallback,
    ]
  );
}

export async function compactFeedScanHintRowsWithLedger(
  deletedIds: (rows: readonly FeedScanHint[]) => readonly string[],
): Promise<void> {
  await sqliteCompactFeedScanHints(deletedIds).catch(() => false);
}

export async function deleteAllFeedScanHintsWithLedger(): Promise<void> {
  await sqliteDeleteAllFeedScanHints().catch(() => false);
}
