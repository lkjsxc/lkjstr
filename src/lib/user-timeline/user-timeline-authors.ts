import type { NostrEvent } from '$lib/protocol';
import {
  authorSetHash,
  targetTimelineAuthors,
} from '$lib/follow-graph/follow-graph-authors';

export type UserTimelineAuthorSet = {
  readonly authors: readonly string[];
  readonly hash: string;
  readonly mode: 'follow_graph' | 'target_posts_only';
};

export function userTimelineAuthorSet(input: {
  readonly targetPubkey: string;
  readonly followList?: NostrEvent | null;
}): UserTimelineAuthorSet {
  const authors = targetTimelineAuthors({
    targetPubkey: input.targetPubkey,
    followList: input.followList,
  });
  return { authors, hash: authorSetHash(authors), mode: 'follow_graph' };
}

export function targetPostsOnlyAuthorSet(
  targetPubkey: string,
): UserTimelineAuthorSet {
  return {
    authors: [targetPubkey],
    hash: authorSetHash([targetPubkey]),
    mode: 'target_posts_only',
  };
}
