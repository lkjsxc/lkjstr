import { beforeCursor } from '$lib/events/repository-shared';
import type { FeedCursorPoint, StoredEvent } from '$lib/events/types';
import { compareEventsDesc } from '$lib/protocol';
import { feedDisplayKinds } from '$lib/events/feed-kinds';
import {
  eventSearchTokenRows,
  normalizeSearchText,
  tokenizeSearchQuery,
} from './search-tokenizer';

const eventsById = new Map<string, StoredEvent>();
const tokensByEvent = new Map<string, string[]>();
const eventIdsByToken = new Map<string, Set<string>>();

export function putMemorySearchEvent(event: StoredEvent): void {
  removeMemorySearchEvent(event.id);
  eventsById.set(event.id, event);
  const tokens = eventSearchTokenRows(event).map((row) => row.token);
  tokensByEvent.set(event.id, tokens);
  for (const token of new Set(tokens)) {
    const ids = eventIdsByToken.get(token) ?? new Set<string>();
    ids.add(event.id);
    eventIdsByToken.set(token, ids);
  }
}

export function memorySearchEvents(input: {
  readonly query: string;
  readonly limit: number;
  readonly before?: FeedCursorPoint;
  readonly kinds?: readonly number[];
}): StoredEvent[] {
  const tokens = tokenizeSearchQuery(input.query);
  if (tokens.length === 0) return [];
  const ids = intersectTokenIds(tokens);
  const kinds = new Set(input.kinds ?? feedDisplayKinds);
  const normalized = normalizeSearchText(input.query.trim());
  return [...ids]
    .flatMap((id) => eventsById.get(id) ?? [])
    .filter((event) => kinds.has(event.kind))
    .filter((event) => beforeCursor(event, input.before))
    .filter((event) => matchesQuery(event.content, normalized, tokens))
    .sort(compareEventsDesc)
    .slice(0, input.limit);
}

export function clearMemorySearchIndex(): void {
  eventsById.clear();
  tokensByEvent.clear();
  eventIdsByToken.clear();
}

function removeMemorySearchEvent(id: string): void {
  for (const token of new Set(tokensByEvent.get(id) ?? [])) {
    const ids = eventIdsByToken.get(token);
    ids?.delete(id);
    if (ids?.size === 0) eventIdsByToken.delete(token);
  }
  tokensByEvent.delete(id);
  eventsById.delete(id);
}

function intersectTokenIds(tokens: readonly string[]): Set<string> {
  const [first, ...rest] = tokens;
  const current = new Set(first ? eventIdsByToken.get(first) : []);
  for (const token of rest) {
    const ids = eventIdsByToken.get(token) ?? new Set<string>();
    for (const id of [...current]) if (!ids.has(id)) current.delete(id);
  }
  return current;
}

function matchesQuery(
  content: string,
  normalizedQuery: string,
  tokens: readonly string[],
): boolean {
  const normalized = normalizeSearchText(content);
  return (
    normalized.includes(normalizedQuery) ||
    tokens.every((token) => normalized.includes(token))
  );
}
