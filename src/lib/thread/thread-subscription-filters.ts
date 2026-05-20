import { kinds, type NostrFilter } from '../protocol';

export function threadLiveFilters(
  eventId: string,
  rootId: string,
  since: number,
  limit: number,
): NostrFilter[] {
  return [
    { ids: [eventId] },
    { ids: [rootId] },
    { kinds: [kinds.textNote], '#e': [rootId, eventId], since, limit },
    {
      kinds: [kinds.reaction, kinds.repost, kinds.genericRepost],
      '#e': [rootId, eventId],
      since,
      limit,
    },
  ];
}

export function isThreadReactionKind(kind: number): boolean {
  return kind === kinds.reaction;
}

export function isThreadRepostKind(kind: number): boolean {
  return kind === kinds.repost || kind === kinds.genericRepost;
}
