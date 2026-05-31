import { cacheLedgerId } from '../../cache/cache-ledger-id';
import { feedScanHintLedgerRecord } from '../../events/feed-cache-ledger';
import type { FeedScanHint } from '../../events/feed-scan-hints';
import { browserDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function putFeedScanHintWithLedger(
  hint: FeedScanHint,
): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['feedScanHints', 'cacheLedger'],
    purpose: 'feed-scan-hint-write',
    run: async (db) => {
      await db.feedScanHints.put(hint);
      await db.cacheLedger.put(feedScanHintLedgerRecord(hint));
    },
  });
}

export async function readFeedScanHintRowsForScan(
  input: {
    readonly scanKey: string;
    readonly direction: FeedScanHint['direction'];
  },
  fallback: readonly FeedScanHint[],
): Promise<FeedScanHint[]> {
  return boundedStorageRead(
    () =>
      browserDb()
        .feedScanHints.where('[scanKey+direction]')
        .equals([input.scanKey, input.direction])
        .toArray(),
    [...fallback],
  );
}

export async function compactFeedScanHintRowsWithLedger(
  deletedIds: (rows: readonly FeedScanHint[]) => readonly string[],
): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['feedScanHints', 'cacheLedger'],
    purpose: 'feed-scan-hint-write',
    run: async (db) => {
      const ids = [...new Set(deletedIds(await db.feedScanHints.toArray()))];
      if (ids.length === 0) return;
      await db.feedScanHints.bulkDelete(ids);
      await db.cacheLedger.bulkDelete(
        ids.map((id) => cacheLedgerId('feed-scan-hint', id)),
      );
    },
  });
}
