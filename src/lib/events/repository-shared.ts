import type { NostrEvent } from '../protocol';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCursorPoint,
  StoredEvent,
} from './types';

export function receipt(
  eventId: string,
  relayUrl: string,
  receivedAt: number,
): EventRelayReceipt {
  return { id: `${eventId}:${relayUrl}`, eventId, relayUrl, receivedAt };
}

export function tagRows(event: NostrEvent): EventTagRow[] {
  return event.tags
    .filter(
      (tag): tag is ['e' | 'p' | 'q' | 'a', string, ...string[]] =>
        ['e', 'p', 'q', 'a'].includes(tag[0] ?? '') && Boolean(tag[1]),
    )
    .map((tag, index) => ({
      id: `${event.id}:${tag[0]}:${tag[1]}:${index}`,
      eventId: event.id,
      tagName: tag[0],
      tagValue: tag[1],
      created_at: event.created_at,
    }));
}

export function before(event: StoredEvent, until: number | undefined): boolean {
  return until === undefined || event.created_at < until;
}

export function beforeCursor(
  event: StoredEvent,
  cursor: FeedCursorPoint | undefined,
): boolean {
  if (!cursor) return true;
  if (event.created_at !== cursor.createdAt)
    return event.created_at < cursor.createdAt;
  return event.id > cursor.id;
}

export function afterCursor(
  event: StoredEvent,
  cursor: FeedCursorPoint | undefined,
): boolean {
  if (!cursor) return true;
  if (event.created_at !== cursor.createdAt)
    return event.created_at > cursor.createdAt;
  return event.id < cursor.id;
}

export function maxUntil(until: number | undefined): number {
  return until === undefined ? Number.MAX_SAFE_INTEGER : until - 1;
}
