import type { NostrEvent } from '../protocol';
import { accountHomeAuthors } from './follow-list';
import type { TimelineProfiles } from './timeline-profiles';
import {
  loadCachedFollowList,
  loadCachedTimeline,
  type TimelineItem,
} from './timeline-store';

export type TimelineLoad = {
  readonly authors: string[];
  readonly cached: TimelineItem[];
  readonly followList?: NostrEvent;
  readonly profiles: TimelineProfiles;
};

export async function loadCachedAccountHome(
  pubkey: string,
  limit: number,
): Promise<TimelineLoad> {
  return loadAccountHome(pubkey, await loadCachedFollowList(pubkey), limit);
}

export async function loadAccountHome(
  pubkey: string,
  followList: NostrEvent | undefined,
  limit: number,
): Promise<TimelineLoad> {
  const authors = accountHomeAuthors(pubkey, followList);
  return {
    authors,
    cached: await loadCachedTimeline(limit, authors),
    followList,
    profiles: {},
  };
}
