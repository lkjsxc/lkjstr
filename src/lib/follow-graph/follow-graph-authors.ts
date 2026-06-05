import type { NostrEvent } from '$lib/protocol';
import { followeeEntries, type FolloweeEntry } from '$lib/profile/followees';

export function targetFollowEntries(
  followList?: NostrEvent | null,
): FolloweeEntry[] {
  return followeeEntries(followList);
}

export function followingCount(followList?: NostrEvent | null): number {
  return targetFollowEntries(followList).length;
}

export function targetTimelineAuthors(input: {
  readonly targetPubkey: string;
  readonly followList?: NostrEvent | null;
  readonly includeFollowees?: boolean;
}): string[] {
  const authors = [input.targetPubkey];
  if (input.includeFollowees !== false)
    authors.push(...targetFollowEntries(input.followList).map((e) => e.pubkey));
  return [...new Set(authors)];
}

export function authorSetHash(authors: readonly string[]): string {
  return authors.slice().sort().join(',');
}
