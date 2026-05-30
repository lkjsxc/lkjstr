import { defaultReadPageMaxEvents } from '../subscription-manager-types';
import type { RequestBudgetInput, RequestBudgetPurpose } from './types';

export const appRequestBudgetCaps = {
  maxEvents: defaultReadPageMaxEvents,
  maxFilterLimit: 500,
  maxSearchLimit: 100,
  maxMetadataLimit: 50,
  maxRouteDiscoveryLimit: 50,
  maxExactLookupLimit: 500,
  maxReqMessageBytes: 64 * 1024,
  timeoutMs: 5000,
} as const;

export function intendedFilterLimit(input: RequestBudgetInput): number {
  const requested = positive(input.requestedFilterLimit);
  if (requested) return requested;
  if (input.phase === 'live') return 0;
  if (input.exactEventLookup) return input.pageSize ?? 1;
  if (input.purpose === 'metadata') return input.pageSize ?? 20;
  if (input.purpose === 'route-discovery') return input.pageSize ?? 20;
  if (input.hasSearchFilter || input.purpose === 'search')
    return input.pageSize ?? appRequestBudgetCaps.maxSearchLimit;
  return input.pageSize ?? 50;
}

export function appFilterCap(
  purpose: RequestBudgetPurpose | undefined,
): number {
  if (purpose === 'metadata') return appRequestBudgetCaps.maxMetadataLimit;
  if (purpose === 'route-discovery')
    return appRequestBudgetCaps.maxRouteDiscoveryLimit;
  if (purpose === 'event-lookup')
    return appRequestBudgetCaps.maxExactLookupLimit;
  if (purpose === 'search') return appRequestBudgetCaps.maxSearchLimit;
  return appRequestBudgetCaps.maxFilterLimit;
}

export function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}
