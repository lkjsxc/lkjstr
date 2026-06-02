import { encodedJsonBytes } from '../cache/cache-byte-size';
import { cacheLedgerBytes } from '../cache/cache-ledger-bytes';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import type { CacheLedgerRecord } from '../cache/cache-ledger-record';
import type { TabStateRecord } from '../storage/tab-state-record';

export function tabStateLedgerRecord(row: TabStateRecord): CacheLedgerRecord {
  const draft: CacheLedgerRecord = {
    id: cacheLedgerId('tab-snapshot', row.id),
    ownerKind: 'tab-snapshot',
    resourceKind: 'tab-state',
    resourceId: row.id,
    score: 50 + Math.floor(row.updatedAt / 3_600_000),
    createdAt: row.updatedAt,
    updatedAt: row.updatedAt,
    cacheBytes: 0,
    protected: false,
    reason: 'tab-snapshot',
  };
  return {
    ...draft,
    cacheBytes: encodedJsonBytes(row) + cacheLedgerBytes(draft),
  };
}
