import { compareEventsDesc } from '../protocol';
import { browserDb } from '../storage/browser-db';
import type { FeedQuery, StoredEvent } from './types';
import { before, maxUntil } from './repository-shared';

export async function indexedPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[]> {
  if (query.kind === 'thread') return indexedThreadPage(query, limit);
  if (query.kind === 'global') return byKindPage(1, query.until, limit);
  const pages = await Promise.all(
    (query.authors ?? []).map((author) =>
      byAuthorPage(author, 1, query.until, limit),
    ),
  );
  return pages.flat().sort(compareEventsDesc).slice(0, limit);
}

async function indexedThreadPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[]> {
  const eventId = query.eventId;
  if (!eventId) return [];
  const rows = await browserDb()
    .eventTags.where('[tagName+tagValue+created_at]')
    .between(['e', eventId, 0], ['e', eventId, maxUntil(query.until)])
    .reverse()
    .limit(limit)
    .toArray();
  const replies = await browserDb().events.bulkGet(
    rows.map((row) => row.eventId),
  );
  const root = await browserDb().events.get(eventId);
  return [...(root && before(root, query.until) ? [root] : []), ...replies]
    .filter((event): event is StoredEvent => Boolean(event))
    .sort(compareEventsDesc)
    .slice(0, limit);
}

function byKindPage(
  kind: number,
  until: number | undefined,
  limit: number,
): Promise<StoredEvent[]> {
  return browserDb()
    .events.where('[kind+created_at]')
    .between([kind, 0], [kind, maxUntil(until)])
    .reverse()
    .limit(limit)
    .toArray();
}

function byAuthorPage(
  pubkey: string,
  kind: number,
  until: number | undefined,
  limit: number,
): Promise<StoredEvent[]> {
  return browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between([pubkey, kind, 0], [pubkey, kind, maxUntil(until)])
    .reverse()
    .limit(limit)
    .toArray();
}
