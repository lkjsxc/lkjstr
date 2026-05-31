import { describe, expect, it } from 'vitest';
import {
  directLedgerResourceSpecs,
  ledgerResourceKinds,
  ledgerResourceManifest,
  ledgerResourceSpec,
} from '../../../src/lib/storage/ledger/ledger-manifest';
import { isStorageTableName } from '../../../src/lib/storage/schema/table-names';

describe('ledger manifest', () => {
  it('covers every cache resource kind once', () => {
    expect([...ledgerResourceKinds].sort()).toEqual([
      'author-relay-route',
      'coverage-row',
      'feed-cursor',
      'job-record',
      'nostr-event',
      'notification-record',
      'relay-info',
      'relay-list-suggestion',
      'relay-summary',
      'scan-hint',
      'tab-state',
    ]);
    expect(new Set(ledgerResourceKinds).size).toBe(ledgerResourceKinds.length);
  });

  it('maps resources to live storage tables', () => {
    for (const spec of ledgerResourceManifest) {
      expect(isStorageTableName(spec.owningTable)).toBe(true);
      expect(ledgerResourceSpec(spec.resourceKind)).toBe(spec);
    }
  });

  it('keeps event resources on the specialized delete path', () => {
    expect(
      directLedgerResourceSpecs().map((spec) => spec.resourceKind),
    ).not.toContain('nostr-event');
    expect(ledgerResourceSpec('nostr-event').eventOwned).toBe(true);
  });
});
