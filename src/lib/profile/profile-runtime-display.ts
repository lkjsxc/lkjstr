import { eventInDisplayBounds } from '$lib/events/feed-display-bounds';
import {
  cursorPoint,
  feedWindowSize,
  mergeFeedWindow,
  oldestCreatedAt,
} from '$lib/events/feed-window';
import { afterCursor } from '$lib/events/repository-shared';
import type { FeedEvent } from '$lib/events/types';
import type { NostrEvent } from '$lib/protocol';
import type { ProfileState } from './profile-state';

export function withProfileCursors(next: ProfileState): ProfileState {
  return {
    ...next,
    newestCursor: cursorPoint(next.posts.at(0)),
    oldestCreatedAt: oldestCreatedAt(next.posts),
    oldestCursor: cursorPoint(next.posts.at(-1)),
  };
}

export function shouldDisplayLiveProfilePost(input: {
  readonly event: NostrEvent;
  readonly state: ProfileState;
  readonly startedAt: number;
}): 'display' | 'has-newer' | 'hidden' {
  if (!eventInDisplayBounds(input.event, { since: input.startedAt }))
    return 'hidden';
  if (
    input.state.newerPruned &&
    afterCursor(input.event, input.state.newestCursor)
  )
    return 'has-newer';
  return 'display';
}

export function mergeProfileLivePost(
  posts: readonly FeedEvent[],
  item: FeedEvent,
) {
  return mergeFeedWindow(posts, [item], feedWindowSize);
}
