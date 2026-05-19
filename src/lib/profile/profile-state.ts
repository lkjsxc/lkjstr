import type { FeedCursorPoint } from '$lib/events/types';
import type { FeedEvent } from '$lib/events/types';
import type { ProfileSummary } from '$lib/identity/identity';

// prettier-ignore
export type ProfileState = {
  readonly profile: ProfileSummary | null; readonly posts: readonly FeedEvent[];
  readonly loading: boolean; readonly error: string | null; readonly relays: readonly string[];
  readonly updatedAt: number | null; readonly loadingOlder: boolean; readonly hasOlder: boolean;
  readonly oldestCreatedAt?: number; readonly oldestCursor?: FeedCursorPoint; readonly newerPruned: boolean;
};

// prettier-ignore
export function emptyProfileState(): ProfileState {
  return { profile: null, posts: [], loading: true, error: null, relays: [], updatedAt: null, loadingOlder: false, hasOlder: true, oldestCreatedAt: undefined, oldestCursor: undefined, newerPruned: false };
}
