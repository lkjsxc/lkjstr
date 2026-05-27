import type { NostrFilter } from '../protocol';
import { feedWindowSize, metadataPageLimit } from '../events/feed-window';
import { boundedErrorText } from '../events/runtime-error';
import { discoverAuthorRelayRoutes } from '../relays/relay-discovery';
import { routedAuthorRelays } from '../relays/relay-routing';
import { liveFeedDemand } from '../relays/orchestration/runtime-demand';
import { authorFilters } from './follow-list';
import { profileFilter } from './timeline-profiles';
import { loadInitialTimelinePage } from './timeline-runtime-paging';
import {
  receiveTimelinePoolEvent,
  type TimelineReceiverContext,
} from './timeline-runtime-receivers';
import { readyWithEventsState } from './timeline-state';
import { mergeTimelineItems } from './timeline-store';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export function createTimelineNetworkSubs(ctx: TimelineNetworkCtx) {
  let routeRelays: string[] = [];

  const loadInitialNotes = async (): Promise<void> => {
    const key = [...ctx.getAuthors()].sort().join(',');
    if (ctx.getInitialNotesKey() === key || ctx.getAuthors().length === 0)
      return;
    ctx.setInitialNotesKey(key);
    try {
      const page = await loadInitialTimelinePage({
        authors: ctx.getAuthors(),
        relays: ctx.relays,
        subId: ctx.noteSubId,
        pageSize: ctx.pageSize,
        subscriptions: ctx.subscriptions,
        signal: ctx.signal,
      });
      ctx.setOlderScanCursor(page.hasOlder ? page.nextOlderCursor : undefined);
      if (page.items.length > 0) {
        ctx.setCached(
          mergeTimelineItems(page.items, ctx.items(), feedWindowSize),
        );
        ctx.emit(
          ctx.nextState(readyWithEventsState(ctx.getState(), ctx.items())),
        );
      } else if (ctx.getState().items.length === 0) {
        ctx.emit(
          ctx.nextState({
            loading: false,
            status: 'ready-empty',
            hasOlder: page.hasOlder,
          }),
        );
      }
    } catch (error) {
      ctx.emit({
        ...ctx.getState(),
        loading: false,
        error: boundedErrorText(error),
      });
    }
  };

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

  const subscribe = (
    channel: string,
    filters: readonly NostrFilter[],
    selectedRelays = ctx.relays,
    purpose: 'feed' | 'metadata' | 'route-discovery' = 'feed',
  ): void => {
    if (ctx.isClosed()) return;
    ctx.cleanup().push(
      ctx.subscriptions.subscribeDemand(
        liveFeedDemand({
          surface: ctx.surface,
          owner: ctx.owner,
          channel,
          relays: selectedRelays,
          filters,
          purpose,
          visibility: ctx.visibility(),
        }),
        (event) => void receiveTimelinePoolEvent(receiverContext(), event),
      ),
    );
  };

  const subscribeNotes = async (): Promise<void> => {
    const initialPage = loadInitialNotes();
    routeRelays = await routedAuthorRelays({
      authors: ctx.getAuthors(),
      selectedRelays: ctx.relays,
      purpose: 'write',
    });
    subscribe(
      'notes',
      authorFilters(ctx.getAuthors(), ctx.pageSize, {}, 'per-filter'),
      routeRelays,
    );
    const missing = ctx
      .getAuthors()
      .filter((pubkey) => !ctx.getProfiles()[pubkey])
      .slice(0, metadataPageLimit);
    const filters = profileFilter(missing);
    if (filters.length > 0) subscribe('meta', filters, ctx.relays, 'metadata');
    void initialPage.then(async () => {
      const run = ctx.getGeneration();
      if (ctx.isClosed()) return;
      await discoverAuthorRelayRoutes({
        authors: ctx.getAuthors(),
        selectedRelays: ctx.relays,
        key: `${ctx.noteSubId}:routes`,
        subscriptions: ctx.subscriptions,
        signal: ctx.signal,
      }).catch(() => undefined);
      if (!ctx.isActive(run)) return;
      const page = await loadInitialTimelinePage({
        authors: ctx.getAuthors(),
        relays: ctx.relays,
        subId: `${ctx.noteSubId}:route-refresh`,
        pageSize: ctx.pageSize,
        subscriptions: ctx.subscriptions,
        signal: ctx.signal,
      }).catch(() => undefined);
      if (!page || !ctx.isActive(run) || page.items.length === 0) return;
      ctx.setCached(
        mergeTimelineItems(page.items, ctx.items(), feedWindowSize),
      );
      ctx.clearLive();
      ctx.emit(
        ctx.nextState(readyWithEventsState(ctx.getState(), ctx.items())),
      );
    });
  };

  return { subscribe, subscribeNotes, receiverContext };
}
