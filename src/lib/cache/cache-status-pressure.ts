import {
  pressureState,
  type CachePressureState,
} from './cache-budget-decision';
import { pressureInput } from './cache-budget-enforcement-helpers';
import type { CacheBudgetSnapshot } from './cache-budget-snapshot';
import { protectionSnapshot } from './compaction-protection';
import {
  emptyPruneSelection,
  lowestScorePruneSelection,
} from './compaction-select';
import type { StorageQuotaSnapshot } from './storage-quota';

export async function cacheStatusPressureState(
  snapshot: CacheBudgetSnapshot,
  quota: StorageQuotaSnapshot | null,
): Promise<CachePressureState> {
  const selection = await pressureSelection();
  return pressureState(
    pressureInput({
      snapshot,
      quota,
      budgetBytes: snapshot.budgetBytes,
      eligibleRows: selection.selectedRows.length,
      protectedRows:
        selection.skippedDurablyProtected +
        selection.skippedDynamicallyProtected,
      prunedResources: 0,
    }),
  );
}

async function pressureSelection() {
  try {
    const protection = await protectionSnapshot();
    return protection.complete
      ? lowestScorePruneSelection(1, protection.ids)
      : emptyPruneSelection();
  } catch {
    return emptyPruneSelection();
  }
}
