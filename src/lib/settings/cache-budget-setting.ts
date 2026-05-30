import { enforceCacheBudget } from '../cache/cache-budget-enforcement';
import type { SettingRecord } from './settings-key';

export function cacheBudgetDecrease(
  current: unknown,
  next: unknown,
): number | undefined {
  const decreased =
    typeof current === 'number' && typeof next === 'number' && next < current;
  return decreased ? next : undefined;
}

export function enforceBudgetIfDecreased(
  before: readonly SettingRecord[],
  next: readonly SettingRecord[],
): void {
  const current = before.find((setting) => setting.key === 'cache.maxBytes');
  const updated = next.find((setting) => setting.key === 'cache.maxBytes');
  const budgetMaxBytes = cacheBudgetDecrease(current?.value, updated?.value);
  if (budgetMaxBytes !== undefined)
    void enforceCacheBudget('settings-change', { maxBytes: budgetMaxBytes });
}
