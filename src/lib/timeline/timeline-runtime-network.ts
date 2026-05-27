import type { RelaySnapshot } from '../relays/types';
import {
  needsSelfFallback,
  relayStatePatch,
  selectedRelaySnapshots,
} from './timeline-relay-state';
import { noFollowListState } from './timeline-state';
import { createTimelineNetworkSubs } from './timeline-runtime-network-subs';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export function createTimelineRuntimeNetwork(ctx: TimelineNetworkCtx) {
  const subs = createTimelineNetworkSubs(ctx);

  const handleMissingFollow = (): void => {
    if (ctx.isClosed()) return;
    ctx.setFollowFallbackStarted(true);
    ctx.setFollowList(undefined);
    ctx.setFollowListId('');
    ctx.setAuthors([ctx.activeAccountPubkey ?? ''].filter(Boolean));
    ctx.emit(
      noFollowListState(ctx.getState(), ctx.getAuthors(), ctx.getProfiles()),
    );
    void subs.subscribeNotes();
  };

  const receiveState = (snapshots: RelaySnapshot[]): void => {
    if (ctx.isClosed()) return;
    const activeRelays = selectedRelaySnapshots(snapshots, ctx.relays);
    if (
      needsSelfFallback(
        activeRelays,
        Boolean(ctx.getFollowList()),
        ctx.getFollowFallbackStarted(),
        ctx.followSubId,
      )
    ) {
      handleMissingFollow();
    }
    ctx.emit({
      ...ctx.getState(),
      ...relayStatePatch(ctx.getState(), activeRelays, ctx.noteSubId),
    });
  };

  return {
    subscribe: subs.subscribe,
    subscribeNotes: subs.subscribeNotes,
    receiveState,
    handleMissingFollow,
  };
}
