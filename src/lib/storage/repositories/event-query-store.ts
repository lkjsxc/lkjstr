import { compareEventsDesc } from '../../protocol';
import { browserDb } from '../browser-db';
import type { FeedQuery, StoredEvent } from '../../events/types';
import {
  afterCursor,
  afterSince,
  before,
  beforeCursor,
  maxUntil,
} from '../../events/repository-shared';
import { normalizeStoredEvent } from '../../events/normalize';
import { feedDisplayKinds } from '../../events/feed-kinds';

export async function indexedPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[]> {
  if (query.kind === 'thread') return indexedThreadPage(query, limit);
  if (query.kind === 'global')
    return byKindsPage(feedKinds(query), query, limit);
  return indexedAuthorPage(query, limit);
}

async function indexedAuthorPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[]> {
  const authors = [...new Set(query.authors ?? [])];
  if (authors.length === 0) return [];
  if (authors.length > 24) return byKindAuthorPage(authors, query, limit);
  const perAuthorLimit =
    authors.length <= 3
      ? limit * 2
      : Math.ceil((limit * 3) / authors.length) + 2;
  const pages = await Promise.all(
    authors.flatMap((author) =>
      feedKinds(query).map((kind) =>
        byAuthorPage(author, kind, query, perAuthorLimit),
      ),
    ),
  );
  return pages
    .flat()
    .map(normalizeStoredEvent)
    .sort(compareEventsDesc)
    .slice(0, limit);
}

async function byKindAuthorPage(
  authors: readonly string[],
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[]> {
  const pages = await Promise.all(
    authors.flatMap((author) =>
      feedKinds(query).map((kind) =>
        byAuthorPage(author, kind, query, Math.ceil(limit / 2)),
      ),
    ),
  );
  return pages
    .flat()
    .map(normalizeStoredEvent)
    .sort(compareEventsDesc)
    .slice(0, limit);
}

export async function indexedLatestByAuthorKind(
  pubkey: string,
  kind: number,
): Promise<StoredEvent | undefined> {
  const [event] = await browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between([pubkey, kind, 0], [pubkey, kind, Number.MAX_SAFE_INTEGER])
    .reverse()
    .limit(1)
    .toArray();
  return event ? normalizeStoredEvent(event) : undefined;
}

export async function indexedEventsByTagValue(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValue: string,
  limit = 500,
): Promise<StoredEvent[]> {
  const rows = await browserDb()
    .eventTags.where('[tagName+tagValue+created_at]')
    .between(
      [tagName, tagValue, 0],
      [tagName, tagValue, Number.MAX_SAFE_INTEGER],
    )
    .reverse()
    .limit(limit)
    .toArray();
  const events = await browserDb().events.bulkGet(
    rows.map((row) => row.eventId),
  );
  return events
    .filter((event): event is StoredEvent => Boolean(event))
    .map(normalizeStoredEvent)
    .sort(compareEventsDesc);
}

export async function indexedEventsByTagValues(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValues: readonly string[],
  limit = 500,
): Promise<StoredEvent[]> {
  const pages = await Promise.all(
    [...new Set(tagValues)].map((tagValue) =>
      indexedEventsByTagValue(tagName, tagValue, limit),
    ),
  );
  return pages
    .flat()
    .map(normalizeStoredEvent)
    .sort(compareEventsDesc)
    .slice(0, limit);
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
    .limit(limit * 3)
    .toArray();
  const replies = await browserDb().events.bulkGet(
    rows.map((row) => row.eventId),
  );
  const root = await browserDb().events.get(eventId);
  return [...(root && before(root, query.until) ? [root] : []), ...replies]
    .filter((event): event is StoredEvent => Boolean(event))
    .map(normalizeStoredEvent)
    .filter((event) => withinBounds(event, query))
    .sort(compareEventsDesc)
    .slice(0, limit);
}

async function byKindsPage(
  kinds: readonly number[],
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[]> {
  const pages = await Promise.all(
    kinds.map((kind) =>
      browserDb()
        .events.where('[kind+created_at]')
        .between([kind, 0], [kind, maxUntil(query.until)])
        .reverse()
        .limit(limit * 3)
        .toArray(),
    ),
  );
  return pages
    .flat()
    .map(normalizeStoredEvent)
    .filter((event) => withinBounds(event, query))
    .sort(compareEventsDesc)
    .slice(0, limit);
}

function byAuthorPage(
  pubkey: string,
  kind: number,
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[]> {
  return browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between([pubkey, kind, 0], [pubkey, kind, maxUntil(query.until)])
    .reverse()
    .limit(limit * 3)
    .toArray()
    .then((events) =>
      events
        .map(normalizeStoredEvent)
        .filter((event) => withinBounds(event, query))
        .slice(0, limit),
    );
}

function withinBounds(event: StoredEvent, query: FeedQuery): boolean {
  return (
    afterSince(event, query.since) &&
    before(event, query.until) &&
    beforeCursor(event, query.before) &&
    afterCursor(event, query.after)
  );
}

// prettier-ignore
function feedKinds(query: FeedQuery): readonly number[] { return query.kinds ?? feedDisplayKinds; }
