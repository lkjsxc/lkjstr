import { isFeedDisplayKind } from '$lib/events/feed-kinds';
import {
  getProfile,
  profileFromMetadataEvent,
} from '$lib/identity/profile-cache';
import type { NostrEvent } from '$lib/protocol';
import type { PoolEvent } from '$lib/relays/relay-pool';
import { storeProfileEvent } from './profile-store';
import type { ProfileState } from './profile-state';
import {
  mergeProfileLivePost,
  shouldDisplayLiveProfilePost,
} from './profile-runtime-display';

export function createProfileRuntimeHandlers(input: {
  readonly pubkey: string;
  readonly startedAt: number;
  readonly isClosed: () => boolean;
  readonly getState: () => ProfileState;
  readonly emit: (state: ProfileState) => void;
}) {
  const receiveFollowList = (event: NostrEvent): void => {
    const state = input.getState();
    const current = state.followList;
    if (current && current.created_at > event.created_at) return;
    if (current?.id === event.id) return;
    input.emit({ ...state, followList: event, loading: false });
  };

  const receiveMeta = (poolEvent: PoolEvent): void => {
    if (poolEvent.event.pubkey !== input.pubkey) return;
    const state = input.getState();
    const updatedAt = poolEvent.event.created_at * 1000;
    if (state.updatedAt && state.updatedAt > updatedAt) return;
    const profile =
      getProfile(input.pubkey) ?? profileFromMetadataEvent(poolEvent.event);
    if (profile.updatedAt > updatedAt) return;
    input.emit({
      ...state,
      profile,
      loading: false,
      relays: [...new Set([...state.relays, poolEvent.relay])],
      updatedAt: profile.updatedAt,
    });
  };

  const receivePost = (event: NostrEvent, relay: string): void => {
    if (input.isClosed()) return;
    const state = input.getState();
    const display = shouldDisplayLiveProfilePost({
      event,
      state,
      startedAt: input.startedAt,
    });
    if (display === 'hidden') return;
    if (display === 'has-newer') {
      input.emit({ ...state, loading: false, hasNewer: true });
      return;
    }
    const window = mergeProfileLivePost(state.posts, {
      event,
      relays: [relay],
    });
    input.emit({
      ...state,
      posts: window.items,
      loading: false,
      hasOlder: state.hasOlder || window.prunedOlder,
    });
  };

  const receive = async (poolEvent: PoolEvent): Promise<void> => {
    if (input.isClosed() || poolEvent.event.pubkey !== input.pubkey) return;
    await storeProfileEvent(poolEvent.event, [poolEvent.relay]);
    if (input.isClosed()) return;
    if (poolEvent.event.kind === 0) receiveMeta(poolEvent);
    if (poolEvent.event.kind === 3) receiveFollowList(poolEvent.event);
    if (isFeedDisplayKind(poolEvent.event.kind)) {
      receivePost(poolEvent.event, poolEvent.relay);
    }
  };

  return { receive };
}
