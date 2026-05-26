import type { FeedEvent } from '$lib/events/types';

export type FeedRowShell = FeedEvent;

export function feedRowShells(events: readonly FeedEvent[]): FeedRowShell[] {
  return events.map((event) => ({ ...event }));
}
