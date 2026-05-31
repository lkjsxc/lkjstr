import type { CachePressureState } from './cache-budget-decision';
import type { CacheLedgerRepairResult } from './cache-ledger-repair';

export type CacheBudgetResult = {
  readonly prunedEvents: number;
  readonly prunedResources: number;
  readonly prunedBytes: number;
  readonly skippedDrafts: true;
  readonly skipped: boolean;
  readonly reason?: string;
  readonly budgetBytes: number;
  readonly ledgerBytes: number;
  readonly prunableCacheBytes: number;
  readonly protectedUserBytes: number;
  readonly unknownOrOverheadBytes: number;
  readonly eventCacheBytes: number;
  readonly browserUsageBytes: number | null;
  readonly protectedOnly: boolean;
  readonly pressureState: CachePressureState;
  readonly skippedDurablyProtected: number;
  readonly skippedDynamicallyProtected: number;
  readonly orphanLedgerRows: number;
  readonly missingLedgerRows: number;
  readonly lastRepairResult?: CacheLedgerRepairResult;
};

export function cacheBudgetResult(input: {
  readonly reason: string;
  readonly budgetBytes: number;
  readonly ledgerBytes: number;
  readonly prunableCacheBytes: number;
  readonly protectedUserBytes: number;
  readonly unknownOrOverheadBytes: number;
  readonly browserUsageBytes: number | null;
  readonly prunedEvents: number;
  readonly prunedResources: number;
  readonly prunedBytes: number;
  readonly eventCacheBytes: number;
  readonly skipped: boolean;
  readonly protectedOnly: boolean;
  readonly pressureState: CachePressureState;
  readonly skippedDurablyProtected?: number;
  readonly skippedDynamicallyProtected?: number;
  readonly orphanLedgerRows?: number;
  readonly missingLedgerRows?: number;
  readonly lastRepairResult?: CacheLedgerRepairResult;
}): CacheBudgetResult {
  return {
    ...input,
    skippedDurablyProtected: input.skippedDurablyProtected ?? 0,
    skippedDynamicallyProtected: input.skippedDynamicallyProtected ?? 0,
    orphanLedgerRows: input.orphanLedgerRows ?? 0,
    missingLedgerRows: input.missingLedgerRows ?? 0,
    skippedDrafts: true,
  };
}
