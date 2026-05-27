import type { NostrEvent } from '../protocol';
import { latestFollowList } from './follow-list';

export function selectLatestFollowList(
  activePubkey: string,
  events: readonly NostrEvent[],
): NostrEvent | undefined {
  return latestFollowList(events, activePubkey);
}

