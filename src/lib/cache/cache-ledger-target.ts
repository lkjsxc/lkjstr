import { sqliteCacheLedgerTargetState } from '../storage/sqlite-opfs/cache-ledger-target-sqlite';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type CacheLedgerTargetState = 'present' | 'missing' | 'unavailable';

export async function cacheLedgerTargetExists(
  row: CacheLedgerRecord,
): Promise<boolean> {
  const state = await cacheLedgerTargetState(row);
  return state !== 'missing';
}

export function cacheLedgerTargetState(
  row: CacheLedgerRecord,
): Promise<CacheLedgerTargetState> {
  return sqliteCacheLedgerTargetState(row);
}
