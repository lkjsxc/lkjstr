import { compareEventsDesc, type NostrEvent } from '../protocol';

export const compareEventsNewestFirst = compareEventsDesc;

export function sortEventsNewestFirst<T extends NostrEvent>(
  events: readonly T[],
): readonly T[] {
  return [...events].sort(compareEventsNewestFirst);
}
