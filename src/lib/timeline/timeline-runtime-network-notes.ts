import { feedWindowSize, metadataPageLimit } from '../events/feed-window';
import { boundedErrorText } from '../events/runtime-error';
import { planAuthorWriteRelays } from '../relays/orchestration/route-plan';
import { authorFilters } from './follow-list';
import { profileFilter } from './timeline-profiles';
import { loadInitialTimelinePage } from './timeline-runtime-paging';
import {
  receiveTimelinePoolEvent,
  type TimelineReceiverContext,
} from './timeline-runtime-receivers';
import { readyWithEventsState } from './timeline-state';
import { mergeTimelineItems } from './timeline-store';
import {
  mergeProgressiveTimelineItems,
  progressiveTimelinePatch,
} from './timeline-progressive';
import { refreshTimelineRoutesAfterInitialPage } from './timeline-runtime-route-refresh';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';

export function createTimelineInitialNotesLoader(ctx: TimelineNetworkCtx) {
  return async (): Promise<void> => {
    const key = [...ctx.getAuthors()].sort().join(',');
    if (ctx.getInitialNotesKey() === key || ctx.getAuthors().length === 0)
      return;
    ctx.setInitialNotesKey(key);
    const run = ctx.getGeneration();
    try {
      const page = await loadInitialTimelinePage({
        surface: ctx.surface,
        owner: ctx.owner,
        authors: ctx.getAuthors(),
        relays: ctx.relays,
        pageSize: ctx.pageSize,
        subscriptions: ctx.subscriptions,
        signal: ctx.signal,
        onSnapshot: (snapshot) => {
          if (!ctx.isActive(run)) return;
          ctx.setCached(
            mergeProgressiveTimelineItems(
              ctx.getCached(),
              snapshot,
              feedWindowSize,
            ),
          );
          ctx.emit(
            ctx.nextState(
              progressiveTimelinePatch(ctx.getState(), ctx.items(), snapshot),
            ),
          );
        },
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
            relayReadStatusText: '',
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
}

export async function attachTimelineNotesSubscriptions(
  ctx: TimelineNetworkCtx,
  receiverContext: () => TimelineReceiverContext,
  loadInitialNotes: () => Promise<void>,
): Promise<void> {
  const initialPage = loadInitialNotes();
  const account = ctx.activeAccountPubkey;
  const onEvent = (event: import('../relays/relay-pool').PoolEvent) =>
    void receiveTimelinePoolEvent(receiverContext(), event);
  if (account && ctx.surface === 'home') {
    ctx.cleanup().push(
      await ctx.subscriptions.submitHomeNotesLiveIntent(
        {
          surface: 'home',
          owner: ctx.owner,
          channel: 'notes',
          visibility: ctx.visibility(),
          selectedRelays: ctx.relays,
          accountPubkey: account,
          authors: ctx.getAuthors(),
          sessionStartedAt: ctx.startedAt,
          filters: authorFilters(ctx.getAuthors(), ctx.pageSize, {
            since: Math.max(0, ctx.startedAt - 30),
          }),
        },
        onEvent,
      ),
    );
  } else if (ctx.getAuthors().length > 0) {
    const relays = await planAuthorWriteRelays({
      surface: ctx.surface,
      authors: ctx.getAuthors(),
      selectedRelays: ctx.relays,
    });
    ctx.cleanup().push(
      ctx.subscriptions.submitLiveIntent(
        {
          surface: ctx.surface,
          owner: ctx.owner,
          channel: 'notes',
          visibility: ctx.visibility(),
          selectedRelays: ctx.relays,
          filters: authorFilters(
            ctx.getAuthors(),
            ctx.pageSize,
            { since: Math.max(0, ctx.startedAt - 30) },
            'per-filter',
          ),
          purpose: 'feed',
          since: Math.max(0, ctx.startedAt - 30),
        },
        relays,
        onEvent,
      ),
    );
  }
  const missing = ctx
    .getAuthors()
    .filter((pubkey) => !ctx.getProfiles()[pubkey])
    .slice(0, metadataPageLimit);
  const metaFilters = profileFilter(missing);
  if (metaFilters.length > 0) {
    ctx.cleanup().push(
      ctx.subscriptions.submitLiveIntent(
        {
          surface: ctx.surface,
          owner: ctx.owner,
          channel: 'meta',
          visibility: ctx.visibility(),
          selectedRelays: ctx.relays,
          filters: metaFilters,
          purpose: 'metadata',
        },
        ctx.relays,
        (event) => void receiveTimelinePoolEvent(receiverContext(), event),
      ),
    );
  }
  void initialPage.then(() => refreshTimelineRoutesAfterInitialPage(ctx));
}
