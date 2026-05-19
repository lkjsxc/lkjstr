import type { NostrEvent } from '../protocol';
import type { EventRelayReceipt, EventTagRow, StoredEvent } from './types';

export function receipt(
  eventId: string,
  relayUrl: string,
  receivedAt: number,
): EventRelayReceipt {
  return { id: `${eventId}:${relayUrl}`, eventId, relayUrl, receivedAt };
}

export function tagRows(event: NostrEvent): EventTagRow[] {
  return event.tags
    .filter((tag): tag is [string, string, ...string[]] =>
      (tag[0] === 'e' || tag[0] === 'p') && Boolean(tag[1]),
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

export function maxUntil(until: number | undefined): number {
  return until === undefined ? Number.MAX_SAFE_INTEGER : until - 1;
}
