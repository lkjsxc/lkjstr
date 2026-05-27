import { relaySafeFilters } from '../../events/nostr-filter-sanitize';
import type { NostrFilter } from '../../protocol';
import { normalizedRelayList } from '../relay-url-list';
import type { RelayRequestPurpose } from '../relay-request-compat';
import type { DemandPhase } from './demand-types';

export type LeaseFingerprintInput = {
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly phase: DemandPhase;
  readonly purpose: RelayRequestPurpose;
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
  readonly channel?: string;
};

function canonicalFilters(
  filters: readonly NostrFilter[],
): readonly NostrFilter[] {
  return relaySafeFilters(
    filters.map((filter) => {
      const next: Record<string, unknown> = { ...filter };
      if (Array.isArray(next.authors)) {
        next.authors = [...new Set(next.authors as string[])].sort();
      }
      if (Array.isArray(next.kinds)) {
        next.kinds = [...new Set(next.kinds as number[])].sort(
          (a, b) => a - b,
        );
      }
      for (const key of Object.keys(next)) {
        if (!key.startsWith('#')) continue;
        const tags = next[key];
        if (!Array.isArray(tags) || tags.length === 0) {
          delete next[key];
          continue;
        }
        next[key] = [...new Set(tags as string[])].sort();
      }
      return next as NostrFilter;
    }),
  );
}

export function leaseFingerprint(input: LeaseFingerprintInput): string {
  return JSON.stringify({
    relays: normalizedRelayList(input.relays).sort(),
    filters: canonicalFilters(input.filters),
    phase: input.phase,
    purpose: input.purpose,
    since: input.since,
    until: input.until,
    limit: input.limit,
    channel: input.channel,
  });
}

export function leaseWireKey(fingerprint: string): string {
  return `lease:${hashString(fingerprint)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).padStart(8, '0').slice(0, 8);
}
