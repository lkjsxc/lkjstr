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
}): CacheBudgetResult {
  return {
    ...input,
    skippedDrafts: true,
  };
}
