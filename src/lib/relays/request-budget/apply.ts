import type { NostrFilter } from '../../protocol';
import {
  defaultReadPageMaxEvents,
  type ReadPageOptions,
} from '../subscription-manager-types';
import type { BudgetedFilters, RequestBudget } from './types';

export function applyBudgetToFilters(
  filters: readonly NostrFilter[],
  budget: RequestBudget,
): BudgetedFilters {
  const filterLimit = budget.filterLimit;
  if (!filterLimit) return { filters, warnings: budget.warnings };
  return {
    filters: filters.map((filter) => ({
      ...filter,
      limit: Math.min(filter.limit ?? filterLimit, filterLimit),
    })),
    warnings: budget.warnings,
  };
}

export function mergeBudgetsForRead(budgets: readonly RequestBudget[]): {
  readonly maxEvents: number;
  readonly timeoutMs: number;
} {
  return {
    maxEvents: Math.min(
      defaultReadPageMaxEvents,
      budgets.reduce((sum, budget) => sum + budget.maxEvents, 0),
    ),
    timeoutMs: Math.max(...budgets.map((budget) => budget.timeoutMs), 5000),
  };
}

export function effectiveReadOptions(
  budgets: readonly RequestBudget[],
  callerOptions: ReadPageOptions = {},
): ReadPageOptions {
  const merged = mergeBudgetsForRead(budgets);
  return {
    ...callerOptions,
    timeoutMs: callerOptions.timeoutMs ?? merged.timeoutMs,
    maxEvents: Math.min(
      callerOptions.maxEvents ?? merged.maxEvents,
      merged.maxEvents,
    ),
  };
}
