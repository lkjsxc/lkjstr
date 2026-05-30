import type { NostrFilter } from '../protocol';
import { defaultReadPageMaxEvents } from '../relays/subscription-manager';
import { cachedRelayInformation } from '../relays/relay-info';
import { applyBudgetToFilters } from '../relays/request-budget/apply';
import { deriveRequestBudget } from '../relays/request-budget/derive';
import type {
  RequestBudgetPurpose,
  RequestBudgetSurface,
} from '../relays/request-budget/types';

export type LimitedRelayFilters = {
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly maxEvents: number;
};

export type RelayFilterLimitContext = {
  readonly surface?: RequestBudgetSurface;
  readonly phase?: 'bootstrap' | 'page' | 'live';
  readonly purpose?: RequestBudgetPurpose;
  readonly exactEventLookup?: boolean;
};

export async function limitedRelayFilterGroups(
  relays: readonly string[],
  filters: readonly NostrFilter[],
  pageSize: number,
  context: RelayFilterLimitContext = {},
): Promise<LimitedRelayFilters[]> {
  const groups = new Map<string, LimitedRelayFilters>();
  for (const relay of relays) {
    const info = cachedRelayInformation(relay)?.info;
    const budget = deriveRequestBudget({
      surface: context.surface ?? budgetSurface(context.purpose, filters),
      phase: context.phase ?? 'page',
      purpose: context.purpose ?? budgetPurpose(filters),
      pageSize,
      relayUrl: relay,
      filterCount: filters.length,
      requestedFilterLimit: requestedLimit(filters),
      hasSearchFilter: hasSearchFilter(filters),
      exactEventLookup: context.exactEventLookup ?? exactLookup(filters),
      relayInfo: info,
    });
    const limited = applyBudgetToFilters(filters, budget).filters;
    const key = JSON.stringify({
      limits: limited.map((item) => item.limit),
      maxEvents: budget.maxEvents,
    });
    const current = groups.get(key);
    groups.set(key, {
      relays: [...(current?.relays ?? []), relay],
      filters: current?.filters ?? limited,
      maxEvents: Math.min(
        defaultReadPageMaxEvents,
        (current?.maxEvents ?? 0) + budget.maxEvents,
      ),
    });
  }
  return [...groups.values()];
}

function requestedLimit(filters: readonly NostrFilter[]): number | undefined {
  const limits = filters
    .map((filter) => filter.limit)
    .filter(
      (limit): limit is number =>
        typeof limit === 'number' && Number.isInteger(limit) && limit > 0,
    );
  return limits.length ? Math.max(...limits) : undefined;
}

function hasSearchFilter(filters: readonly NostrFilter[]): boolean {
  return filters.some((filter) => typeof filter.search === 'string');
}

function exactLookup(filters: readonly NostrFilter[]): boolean {
  return filters.some((filter) => Boolean(filter.ids?.length));
}

function budgetPurpose(filters: readonly NostrFilter[]): RequestBudgetPurpose {
  if (hasSearchFilter(filters)) return 'search';
  if (exactLookup(filters)) return 'event-lookup';
  return 'feed';
}

function budgetSurface(
  purpose: RequestBudgetPurpose | undefined,
  filters: readonly NostrFilter[],
): RequestBudgetSurface {
  return purpose === 'search' || hasSearchFilter(filters) ? 'search' : 'home';
}
