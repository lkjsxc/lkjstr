import type { NostrFilter } from '../protocol';
import { createBoundedMap } from '../fp/bounded-map';
import { normalizedRelayList } from './relay-url-list';

export type RelayRequestPurpose =
  | 'feed'
  | 'metadata'
  | 'event-lookup'
  | 'route-discovery'
  | 'search';

type RelayPolicy = {
  readonly requiresKinds?: boolean;
  readonly requiresSearch?: boolean;
};

const policies = createBoundedMap<string, RelayPolicy>({
  maxSize: 250,
  ttlMs: 60 * 60 * 1000,
});

export function compatibleRelayList(
  relays: readonly string[],
  filters: readonly NostrFilter[],
  purpose?: RelayRequestPurpose,
): string[] {
  return normalizedRelayList(relays).filter((relay) =>
    relayCompatible(relay, filters, purpose),
  );
}

export function recordRelayClosedPolicy(
  relay: string,
  message: string,
  filters: readonly NostrFilter[],
): void {
  const current = policies.get(relay) ?? {};
  const lower = message.toLowerCase();
  policies.set(relay, {
    ...current,
    requiresKinds: current.requiresKinds || requiresKinds(lower, filters),
    requiresSearch: current.requiresSearch || requiresSearch(lower, filters),
  });
}

export function clearRelayRequestCompatibilityForTests(): void {
  policies.clear();
}

export function relayRequestCompatibilitySizeForTests(): number {
  return policies.size();
}

function relayCompatible(
  relay: string,
  filters: readonly NostrFilter[],
  purpose?: RelayRequestPurpose,
): boolean {
  const policy = policies.get(relay);
  if (!policy) return true;
  if (policy.requiresKinds && filters.some((filter) => !filter.kinds?.length))
    return false;
  if (
    policy.requiresSearch &&
    purpose !== 'search' &&
    filters.some((filter) => typeof filter.search !== 'string')
  )
    return false;
  return true;
}

function requiresKinds(
  message: string,
  filters: readonly NostrFilter[],
): boolean {
  return message.includes('requires kinds') && filters.some((f) => !f.kinds);
}

function requiresSearch(
  message: string,
  filters: readonly NostrFilter[],
): boolean {
  return message.includes('requires search') && filters.some((f) => !f.search);
}
