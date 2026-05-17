import type { NostrEvent, NostrTag } from './event';

export type IndexedTags = {
  readonly events: readonly string[];
  readonly pubkeys: readonly string[];
  readonly topics: readonly string[];
  readonly relays: readonly string[];
};

export function firstTagValue(
  event: NostrEvent,
  name: string,
): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

export function tagValues(event: NostrEvent, name: string): string[] {
  return event.tags.flatMap((tag) =>
    tag[0] === name && tag[1] ? [tag[1]] : [],
  );
}

export function indexTags(event: NostrEvent): IndexedTags {
  return {
    events: tagValues(event, 'e'),
    pubkeys: tagValues(event, 'p'),
    topics: tagValues(event, 't'),
    relays: tagValues(event, 'r'),
  };
}

export function replyRoot(event: NostrEvent): string | undefined {
  return marker(event.tags, 'root') ?? tagValues(event, 'e')[0];
}

export function replyParent(event: NostrEvent): string | undefined {
  const reply = marker(event.tags, 'reply');
  if (reply) return reply;
  const events = tagValues(event, 'e');
  return events.length > 1 ? events[events.length - 1] : undefined;
}

function marker(
  tags: readonly NostrTag[],
  markerName: string,
): string | undefined {
  return tags.find((tag) => tag[0] === 'e' && tag[3] === markerName)?.[1];
}
