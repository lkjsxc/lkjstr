import { feedDisplayKinds } from '$lib/events/feed-kinds';
import type { NostrFilter } from '$lib/protocol';

export function profileLiveFilters(
  pubkey: string,
  since: number,
  limit: number,
): NostrFilter[] {
  return [
    { kinds: [0], authors: [pubkey], limit: 1 },
    { kinds: [3], authors: [pubkey], limit: 1 },
    { kinds: feedDisplayKinds, authors: [pubkey], since, limit },
  ];
}
