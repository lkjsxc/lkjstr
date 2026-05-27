import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import type { RelayReadRequest } from '../events/types';
import { normalizedRelayList } from './relay-url-list';
import {
  defaultReadPageMaxEvents,
  type ReadPageOptions,
} from './subscription-manager-types';

export function subscriptionKey(request: RelayReadRequest): string {
  return JSON.stringify({
    key: request.key,
    relays: normalizedRelayList(request.relays),
    filters: relaySafeFilters(request.filters),
    purpose: request.purpose,
  });
}

/** @deprecated Use lease fingerprints via the subscription orchestrator. */
export function legacySubscriptionKey(request: RelayReadRequest): string {
  return subscriptionKey(request);
}

export function readDedupeKey(
  request: RelayReadRequest,
  options: ReadPageOptions,
): string {
  return JSON.stringify({
    request: subscriptionKey(request),
    timeoutMs: options.timeoutMs ?? 5000,
    maxEvents: options.maxEvents ?? defaultReadPageMaxEvents,
  });
}

export function relaySafeReadRequest(
  request: RelayReadRequest,
): RelayReadRequest {
  return { ...request, filters: relaySafeFilters(request.filters) };
}
