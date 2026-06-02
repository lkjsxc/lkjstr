import { normalizeStoredEvent } from '../../events/normalize';
import type { StoredEvent } from '../../events/types';
import type { SqlRow } from './types';

export const storedEventColumns = 'event_json, relay_urls_json';

export function decodeStoredEventRow(row: SqlRow): StoredEvent | undefined {
  if (typeof row.event_json !== 'string') return undefined;
  try {
    const parsed = JSON.parse(row.event_json) as Partial<StoredEvent>;
    const relays = JSON.parse(String(row.relay_urls_json ?? '[]')) as unknown;
    const relayUrls = Array.isArray(relays)
      ? relays.filter((item): item is string => typeof item === 'string')
      : undefined;
    return normalizeStoredEvent({ ...parsed, relayUrls });
  } catch {
    return undefined;
  }
}
