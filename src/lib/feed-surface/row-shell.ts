import type { FeedEvent } from '$lib/events/types';

export type FeedRowShell = FeedEvent;

export type FeedRowChrome = {
  readonly showSeparator: boolean;
};

export const defaultFeedRowChrome: FeedRowChrome = { showSeparator: true };

export function feedRowShells(events: readonly FeedEvent[]): FeedRowShell[] {
  return events.map((event) => ({ ...event }));
}

export function embeddedRowChrome(): FeedRowChrome {
  return { showSeparator: false };
}
