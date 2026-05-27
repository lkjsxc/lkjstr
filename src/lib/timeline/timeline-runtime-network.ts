import type { RelaySnapshot } from '../relays/types';
import { loadAccountHome } from './timeline-load';
import { upsertEvent } from '../events/repository';
import {
  followDiscoveryFinishedWithoutList,
  relayStatePatch,
  selectedRelaySnapshots,
} from './timeline-relay-state';
import { noFollowListState } from './timeline-state';
import { loadCachedFollowList } from './timeline-store';
import { createTimelineNetworkSubs } from './timeline-runtime-network-subs';
import { readLatestFollowListFromRelays } from './follow-list-sync';
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

  const bootstrapFollowList = async (): Promise<void> => {
    if (ctx.isClosed() || !ctx.activeAccountPubkey) return;
    if (ctx.getFollowList()) return;

    ctx.setFollowFallbackStarted(true);
    const pubkey = ctx.activeAccountPubkey;

    const result = await readLatestFollowListFromRelays({
      activePubkey: pubkey,
      selectedRelays: ctx.relays,
      subscriptions: ctx.subscriptions,
      signal: ctx.signal,
      key: `${ctx.owner}:${ctx.followSubId}:bootstrap`,
    });

    if (ctx.isClosed()) return;
    ctx.setFollowFallbackStarted(false);

    if (result.type === 'found') {
      await upsertEvent(result.followList, result.relayUrls);
      ctx.setFollowList(result.followList);
      ctx.setFollowListId(result.followList.id);
      ctx.applyLoaded(await loadAccountHome(pubkey, result.followList, ctx.pageSize));
      ctx.emit(
        ctx.nextState({
          items: ctx.items(),
          loading: true,
          error: null,
          status: 'loading-follows',
        }),
      );
      void subs.subscribeNotes();
      // Keep following up in the background as a refresh mechanism.
      subs.subscribe(
        'follows',
        [{ kinds: [3], authors: [pubkey], limit: 1 }],
        ctx.relays,
        'metadata',
      );
      return;
    }

    // Not found / partial failure / all failed: show explicit guidance.
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
      followDiscoveryFinishedWithoutList(
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
    bootstrapFollowList,
    receiveState,
    handleMissingFollow,
    retryFollowDiscovery,
  };
}
