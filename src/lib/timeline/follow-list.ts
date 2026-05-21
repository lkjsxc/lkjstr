import { isPubkey, type NostrEvent, type NostrFilter } from '../protocol';
import { feedDisplayKinds } from '../events/feed-kinds';

const maxAuthorsPerFilter = 200;

export function accountHomeAuthors(
  activePubkey: string,
  followList?: NostrEvent,
): string[] {
  const authors = new Set<string>([activePubkey]);
  if (followList?.kind !== 3) return [...authors];
  for (const tag of followList.tags) {
    const pubkey = tag[0] === 'p' ? tag[1] : undefined;
    if (pubkey && isPubkey(pubkey)) authors.add(pubkey);
  }
  return [...authors];
}

export function authorFilters(
  authors: readonly string[],
  limit: number,
  bounds: Pick<NostrFilter, 'since' | 'until'> = {},
): NostrFilter[] {
  const filters: NostrFilter[] = [];
  const chunks = Math.max(1, Math.ceil(authors.length / maxAuthorsPerFilter));
  const budget = Math.max(0, limit);
  const baseLimit = Math.floor(budget / chunks);
  const remainder = budget % chunks;
  let chunk = 0;
  for (let index = 0; index < authors.length; index += maxAuthorsPerFilter) {
    filters.push({
      kinds: feedDisplayKinds,
      authors: authors.slice(index, index + maxAuthorsPerFilter),
      limit: baseLimit + (chunk < remainder ? 1 : 0),
      ...bounds,
    });
    chunk++;
  }
  return filters;
}

export function latestFollowList(
  events: readonly NostrEvent[],
  pubkey: string,
): NostrEvent | undefined {
  return events
    .filter((event) => event.kind === 3 && event.pubkey === pubkey)
    .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))[0];
}
