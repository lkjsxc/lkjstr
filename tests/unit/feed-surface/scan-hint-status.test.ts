import { describe, expect, it } from 'vitest';
import {
  scanHintStatusForTrace,
  scanHintStatusRows,
} from '../../../src/lib/feed-surface/scan-hint-status';
import type { ScanDecisionTraceRecord } from '../../../src/lib/feed-surface/scan-model-records';

describe('scan hint status projection', () => {
  it('reads Rust raw planner hint status from decision trace JSON', () => {
    expect(
      scanHintStatusForTrace(
        trace({
          bridge: { raw: { hint_status: 'used' } },
        }),
      ),
    ).toBe('used');
  });

  it('groups every recent hint status without inventing traces', () => {
    const rows = scanHintStatusRows([
      trace({ bridge: { raw: { hint_status: 'used' } } }),
      trace({ bridge: { raw: { hint_status: 'expired' } } }),
      trace({ bridge: { raw: { hint_status: 'rejected' } } }),
      trace({ bridge: { raw: { hint_status: 'unavailable' } } }),
      trace({ context: { relayUrl: 'wss://old.example/' } }),
    ]);

    expect(
      Object.fromEntries(rows.map((row) => [row.status, row.count])),
    ).toEqual({
      used: 1,
      expired: 1,
      rejected: 1,
      unavailable: 1,
      unknown: 1,
    });
  });

  it('keeps empty debug state empty', () => {
    expect(scanHintStatusRows([])).toEqual([]);
  });
});

function trace(recordJson: unknown): ScanDecisionTraceRecord {
  return {
    traceId: 'trace',
    modelKey: 'model',
    semanticFeedKey: 'home:test',
    direction: 'older',
    createdAtMs: 100,
    recordJson,
  };
}
