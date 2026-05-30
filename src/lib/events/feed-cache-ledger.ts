import { encodedJsonBytes } from '../cache/cache-byte-size';
import { cacheLedgerBytes } from '../cache/cache-ledger-bytes';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import type { CacheLedgerRecord } from '../cache/cache-ledger-record';
import type { FeedScanHint } from './feed-scan-hints';
import type { FeedCoverage, FeedCursor } from './types';

export function feedCursorLedgerRecord(
  cursor: FeedCursor,
): CacheLedgerRecord {
  const draft = feedLedgerDraft('feed-page', 'feed-cursor', cursor);
  return withBytes(draft, cursor);
}

export function feedCoverageLedgerRecord(
  coverage: FeedCoverage,
): CacheLedgerRecord {
  const statusPenalty = coverage.status === 'complete' ? 500 : 100;
  const draft = feedLedgerDraft(
    'feed-coverage',
    'coverage-row',
    coverage,
    statusPenalty,
    coverage.relayUrl,
  );
  return withBytes(draft, coverage);
}

export function feedScanHintLedgerRecord(
  hint: FeedScanHint,
): CacheLedgerRecord {
  const draft = feedLedgerDraft(
    'feed-scan-hint',
    'scan-hint',
    {
      id: hint.id,
      feedKey: hint.scanKey,
      updatedAt: hint.updatedAt,
    },
    50,
    hint.relayUrl,
  );
  return withBytes(draft, hint);
}

function feedLedgerDraft(
  ownerKind: CacheLedgerRecord['ownerKind'],
  resourceKind: CacheLedgerRecord['resourceKind'],
  row: { readonly id: string; readonly feedKey: string; readonly updatedAt: number },
  baseScore = 300,
  relayUrl?: string,
): CacheLedgerRecord {
  return {
    id: cacheLedgerId(ownerKind, row.id),
    ownerKind,
    resourceKind,
    resourceId: row.id,
    score: baseScore + Math.floor(row.updatedAt / 3_600_000),
    createdAt: row.updatedAt,
    updatedAt: row.updatedAt,
    cacheBytes: 0,
    protected: false,
    feedKey: row.feedKey,
    relayUrl,
    reason: 'derived-feed-cache',
  };
}

function withBytes(
  draft: CacheLedgerRecord,
  row: unknown,
): CacheLedgerRecord {
  return {
    ...draft,
    cacheBytes: encodedJsonBytes(row) + cacheLedgerBytes(draft),
  };
}
