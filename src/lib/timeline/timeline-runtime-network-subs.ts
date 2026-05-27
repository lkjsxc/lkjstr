import {
  attachTimelineNotesSubscriptions,
  createTimelineInitialNotesLoader,
} from './timeline-runtime-network-notes';
import {
  receiveTimelinePoolEvent,
  type TimelineReceiverContext,
} from './timeline-runtime-receivers';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export function createTimelineNetworkSubs(ctx: TimelineNetworkCtx) {
  const loadInitialNotes = createTimelineInitialNotesLoader(ctx);
  const receiverContext = (): TimelineReceiverContext => ({
    closed: ctx.isClosed,
    followSubId: ctx.followSubId,
    metaSubId: ctx.metaSubId,
    noteSubId: ctx.noteSubId,
    pageSize: ctx.pageSize,
    getFollowList: ctx.getFollowList,
    setFollowList: ctx.setFollowList,
    getFollowListId: ctx.getFollowListId,
    setFollowListId: ctx.setFollowListId,
    getAuthors: ctx.getAuthors,
    setAuthors: ctx.setAuthors,
    getProfiles: ctx.getProfiles,
    setProfiles: ctx.setProfiles,
    applyLoaded: ctx.applyLoaded,
    emit: ctx.emit,
    nextState: ctx.nextState,
    items: ctx.items,
    withCursors: ctx.withCursors,
    subscribeNotes,
    getState: ctx.getState,
    setLive: ctx.setLive,
    getLive: ctx.getLive,
  });
  const subscribeNotes = (): Promise<void> =>
    attachTimelineNotesSubscriptions(ctx, receiverContext, loadInitialNotes);
  const subscribe = (
    channel: string,
    filters: readonly import('../protocol').NostrFilter[],
    relays: readonly string[],
    purpose: 'feed' | 'metadata' | 'route-discovery',
  ): (() => void) =>
    ctx.subscriptions.submitLiveIntent(
      {
        surface: ctx.surface,
        owner: ctx.owner,
        channel,
        visibility: ctx.visibility(),
        selectedRelays: relays,
        filters,
        purpose,
      },
      relays,
      (event) => void receiveTimelinePoolEvent(receiverContext(), event),
    );
  return { subscribe, subscribeNotes, receiverContext };
}
