import {
  compareEventsDesc,
  matchesFilter,
  type NostrFilter,
} from '../protocol';
import { browserDb } from '../storage/browser-db';
import { normalizeStoredEvent } from './normalize';
import { before, maxUntil } from './repository-shared';
import { indexedEventsByTagValues } from './repository-indexed';
import type { StoredEvent } from './types';

export async function indexedEventsMatching(
  filters: readonly NostrFilter[],
  limit = 500,
): Promise<StoredEvent[]> {
  const cap = matchingLimit(filters, limit);
  const pages = await Promise.all(
    filters.map((filter) => indexedFilterCandidates(filter, cap)),
  );
  const byId = new Map<string, StoredEvent>();
  for (const event of pages.flat()) {
    if (filters.some((filter) => matchesFilter(event, filter)))
      byId.set(event.id, normalizeStoredEvent(event));
  }
  return [...byId.values()].sort(compareEventsDesc).slice(0, cap);
}

async function indexedFilterCandidates(
  filter: NostrFilter,
  limit: number,
): Promise<StoredEvent[]> {
  const exactIds = filter.ids?.filter((id) => id.length === 64) ?? [];
  if (exactIds.length > 0)
    return normalizeCandidates(
      await browserDb().events.bulkGet(exactIds),
      limit,
    );
  const tagFilter = firstTagFilter(filter);
  if (tagFilter)
    return indexedEventsByTagValues(
      tagFilter.name,
      tagFilter.values,
      limit * 3,
    );
  const authors = [...new Set(filter.authors ?? [])];
  const kinds = [...new Set(filter.kinds ?? [])];
  if (authors.length > 0 && kinds.length > 0)
    return authorKindCandidates(authors, kinds, filter, limit);
  if (kinds.length > 0) return kindCandidates(kinds, filter, limit);
  if (authors.length > 0) return authorCandidates(authors, filter, limit);
  const events = await browserDb()
    .events.orderBy('created_at')
    .reverse()
    .limit(limit * 3)
    .toArray();
  return normalizeCandidates(events, limit);
}

async function authorKindCandidates(
  authors: readonly string[],
  kinds: readonly number[],
  filter: NostrFilter,
  limit: number,
): Promise<StoredEvent[]> {
  const per = perIndexCandidateLimit(authors.length * kinds.length, limit);
  const pages = await Promise.all(
    authors.flatMap((author) =>
      kinds.map((kind) =>
        browserDb()
          .events.where('[pubkey+kind+created_at]')
          .between([author, kind, 0], [author, kind, maxUntil(filter.until)])
          .reverse()
          .limit(per)
          .toArray(),
      ),
    ),
  );
  return normalizeCandidates(pages.flat(), limit);
}

async function kindCandidates(
  kinds: readonly number[],
  filter: NostrFilter,
  limit: number,
): Promise<StoredEvent[]> {
  const per = perIndexCandidateLimit(kinds.length, limit);
  const pages = await Promise.all(
    kinds.map((kind) =>
      browserDb()
        .events.where('[kind+created_at]')
        .between([kind, 0], [kind, maxUntil(filter.until)])
        .reverse()
        .limit(per)
        .toArray(),
    ),
  );
  return normalizeCandidates(pages.flat(), limit);
}

async function authorCandidates(
  authors: readonly string[],
  filter: NostrFilter,
  limit: number,
): Promise<StoredEvent[]> {
  const per = perIndexCandidateLimit(authors.length, limit);
  const pages = await Promise.all(
    authors.map((author) =>
      browserDb()
        .events.where('pubkey')
        .equals(author)
        .reverse()
        .limit(per)
        .toArray(),
    ),
  );
  return normalizeCandidates(
    pages.flat().filter((event) => before(event, filter.until)),
    limit,
  );
}

function firstTagFilter(
  filter: NostrFilter,
):
  | { readonly name: 'e' | 'p' | 'q' | 'a'; readonly values: readonly string[] }
  | undefined {
  for (const [key, values] of Object.entries(filter)) {
    if (
      key.length === 2 &&
      ['#e', '#p', '#q', '#a'].includes(key) &&
      Array.isArray(values)
    )
      return { name: key.slice(1) as 'e' | 'p' | 'q' | 'a', values };
  }
  return undefined;
}

function normalizeCandidates(
  events: readonly (StoredEvent | undefined)[],
  limit: number,
): StoredEvent[] {
  return events
    .filter((event): event is StoredEvent => Boolean(event))
    .map(normalizeStoredEvent)
    .sort(compareEventsDesc)
    .slice(0, limit * 3);
}

function matchingLimit(filters: readonly NostrFilter[], limit: number): number {
  const requested = filters.flatMap((filter) =>
    filter.limit === undefined ? [] : [filter.limit],
  );
  return Math.max(
    1,
    Math.min(limit, requested.length ? Math.max(...requested) : limit),
  );
}

function perIndexCandidateLimit(count: number, limit: number): number {
  return Math.max(1, Math.ceil((limit * 3) / Math.max(1, count)));
}
