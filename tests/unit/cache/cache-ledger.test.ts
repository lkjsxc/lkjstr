import { describe, expect, it } from 'vitest';
import { compareCacheLedgerRows } from '../../../src/lib/cache/cache-ledger-score';
import { selectPruneIds } from '../../../src/lib/cache/compaction';
import {
  feedCoverageLedgerRecord,
  feedScanHintLedgerRecord,
} from '../../../src/lib/events/feed-cache-ledger';
import { jobLedgerRecord } from '../../../src/lib/jobs/job-ledger';
import {
  notificationLedgerRecord,
  scoreNotification,
} from '../../../src/lib/notifications/notification-ledger';
import type { NotificationRecord } from '../../../src/lib/notifications/notification';

describe('cache ledger policy', () => {
  it('prunes low-value reactions before important mentions', () => {
    const reaction = notification('reaction', 100);
    const mention = notification('mention', 100);
    expect(scoreNotification(reaction)).toBeLessThan(
      scoreNotification(mention),
    );
  });

  it('orders stale scan hints before recent feed coverage', () => {
    const hint = feedScanHintLedgerRecord({
      id: 'hint',
      scanKey: 'home',
      relayUrl: 'wss://relay.example',
      groupKey: 'selected',
      filterKey: 'kind1',
      direction: 'older',
      recommendedSpanSeconds: 60,
      lastSpanSeconds: 120,
      lastFeedback: 'balanced',
      updatedAt: 10,
    });
    const coverage = feedCoverageLedgerRecord({
      id: 'coverage',
      feedKey: 'home',
      relayUrl: 'wss://relay.example',
      groupKey: 'selected',
      filterKey: 'kind1',
      status: 'complete',
      updatedAt: 1_000_000,
    });
    expect(compareCacheLedgerRows(hint, coverage)).toBeLessThan(0);
  });

  it('protects active jobs and ranks old finished jobs low', () => {
    const active = jobLedgerRecord(job('running', 1_000_000));
    const finished = jobLedgerRecord(job('completed', 10));
    expect(active.protected).toBe(true);
    expect(finished.protected).toBe(false);
    expect(compareCacheLedgerRows(finished, active)).toBeLessThan(0);
  });

  it('skips durable and dynamic protected ledger rows', () => {
    const rows = [
      notificationLedgerRecord(notification('reaction', 10)),
      {
        ...notificationLedgerRecord(notification('mention', 20)),
        protected: true,
      },
      notificationLedgerRecord(notification('reply', 30)),
    ];
    expect(selectPruneIds(rows, new Set([rows[2].id]), 3)).toEqual([
      rows[0].resourceId,
    ]);
  });
});

function notification(
  kind: NotificationRecord['kind'],
  createdAt: number,
): NotificationRecord {
  return {
    id: `${kind}:${createdAt}`,
    accountPubkey: 'a',
    sourceEventId: `e:${createdAt}`,
    actorPubkey: 'p',
    kind,
    createdAt,
    receivedAt: createdAt,
    muted: false,
    hidden: false,
    relayUrls: [],
  };
}

function job(status: 'running' | 'completed', updatedAt: number) {
  return {
    id: `job:${status}`,
    kind: 'cache-maintenance' as const,
    status,
    input: {},
    rootId: 'root',
    path: ['root'],
    createdAt: updatedAt,
    updatedAt,
  };
}
