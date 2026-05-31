import { browserDb } from '../storage/browser-db';
import { ledgerResourceSpec } from '../storage/ledger/ledger-manifest';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type CacheLedgerTargetState = 'present' | 'missing' | 'unavailable';

export async function cacheLedgerTargetExists(
  row: CacheLedgerRecord,
): Promise<boolean> {
  const state = await cacheLedgerTargetState(row);
  return state !== 'missing';
}

export async function cacheLedgerTargetState(
  row: CacheLedgerRecord,
): Promise<CacheLedgerTargetState> {
  const id = row.resourceId;
  try {
    const table = ledgerResourceSpec(row.resourceKind).owningTable;
    return found(await browserDb()[table].get(id));
  } catch {
    return 'unavailable';
  }
}

function found(row: unknown): CacheLedgerTargetState {
  return row ? 'present' : 'missing';
}
