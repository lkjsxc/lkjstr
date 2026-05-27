import type { RelaySnapshot } from '../relays/types';
import { loadAccountHome } from './timeline-load';
import {
  needsSelfFallback,
  relayStatePatch,
  selectedRelaySnapshots,
} from './timeline-relay-state';
import { noFollowListState } from './timeline-state';
import { loadCachedFollowList } from './timeline-store';
import { createTimelineNetworkSubs } from './timeline-runtime-network-subs';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export function createTimelineRuntimeNetwork(ctx: TimelineNetworkCtx) {
  const subs = createTimelineNetworkSubs(ctx);

  const handleMissingFollow = async (): Promise<void> => {
    if (ctx.isClosed()) return;
    ctx.setFollowFallbackStarted(true);
    const pubkey = ctx.activeAccountPubkey;
    if (pubkey) {
      const cached = await loadCachedFollowList(pubkey);
      if (cached && !ctx.isClosed()) {
        ctx.setFollowFallbackStarted(false);
        ctx.setFollowList(cached);
        ctx.setFollowListId(cached.id);
        ctx.applyLoaded(await loadAccountHome(pubkey, cached, ctx.pageSize));
        if (ctx.isClosed()) return;
        ctx.emit(
          ctx.nextState({
            items: ctx.items(),
            loading: true,
            error: null,
            status: 'loading-follows',
          }),
        );
        void subs.subscribeNotes();
        return;
      }
    }
    ctx.setFollowList(undefined);
    ctx.setFollowListId('');
    ctx.setAuthors([]);
    ctx.setCached([]);
    ctx.clearLive();
    ctx.emit(noFollowListState(ctx.getState(), [], ctx.getProfiles(), []));
  };

  const retryFollowDiscovery = (): void => {
    if (ctx.isClosed() || !ctx.activeAccountPubkey) return;
    ctx.setFollowFallbackStarted(false);
    ctx.setFollowList(undefined);
    ctx.setFollowListId('');
    ctx.emit(
      ctx.nextState({
        loading: true,
        error: null,
        status: 'loading-follows',
      }),
    );
    subs.subscribe(
      'follows',
      [{ kinds: [3], authors: [ctx.activeAccountPubkey], limit: 1 }],
      ctx.relays,
      'metadata',
    );
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
      void handleMissingFollow();
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
    retryFollowDiscovery,
  };
}
