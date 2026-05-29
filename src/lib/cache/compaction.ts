import {
  enforceCacheBudget,
  type CacheBudgetOptions,
  type CacheBudgetResult,
} from './cache-budget-enforcement';
export {
  latestEventIdsByPubkey,
  type CompactionEventCandidate,
} from './compaction-protection';
export { isPrunablePriorityRow, selectPruneIds } from './compaction-select';

export type CompactionOptions = CacheBudgetOptions;
export type CompactionResult = CacheBudgetResult;

export async function compactOldEvents(
  options: CompactionOptions = {},
): Promise<CompactionResult> {
  return enforceCacheBudget('quota-pressure', options);
}
