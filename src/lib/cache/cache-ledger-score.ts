import type { CacheLedgerRecord } from './cache-ledger-record';

export function compareCacheLedgerRows(
  a: CacheLedgerRecord,
  b: CacheLedgerRecord,
): number {
  return (
    a.score - b.score ||
    a.createdAt - b.createdAt ||
    a.id.localeCompare(b.id)
  );
}
