import type { FeedCursorPoint } from '$lib/events/types';
import type { FeedEvent } from '$lib/events/types';
import type { ProfileSummary } from '$lib/identity/identity';
import type { NostrEvent } from '$lib/protocol';

export type ProfileState = {
  readonly profile: ProfileSummary | null;
  readonly posts: readonly FeedEvent[];
  readonly followList?: NostrEvent;
  readonly loading: boolean;
  readonly error: string | null;
  readonly relays: readonly string[];
  readonly updatedAt: number | null;
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly loadingNewer: boolean;
  readonly hasNewer: boolean;
  readonly newestCursor?: FeedCursorPoint;
  readonly oldestCreatedAt?: number;
  readonly oldestCursor?: FeedCursorPoint;
  readonly newerPruned: boolean;
};

export function emptyProfileState(): ProfileState {
  return {
    profile: null,
    posts: [],
    followList: undefined,
    loading: true,
    error: null,
    relays: [],
    updatedAt: null,
    loadingOlder: false,
    hasOlder: true,
    loadingNewer: false,
    hasNewer: false,
    newestCursor: undefined,
    oldestCreatedAt: undefined,
    oldestCursor: undefined,
    newerPruned: false,
  };
}
