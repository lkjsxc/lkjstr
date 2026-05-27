import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { loadCachedAccountHome } from './timeline-load';
import type { TimelineLoad } from './timeline-load';
import {
  noActiveAccountState,
  noEnabledRelayState,
  readyWithEventsState,
  type TimelineState,
} from './timeline-state';
import { loadCachedTimeline, type TimelineItem } from './timeline-store';
import type { createTimelineRuntimeNetwork } from './timeline-runtime-network';
import type { TimelineRuntimeOptions } from './timeline-state';

type Network = ReturnType<typeof createTimelineRuntimeNetwork>;

export async function startTimelineRuntime(args: {
  readonly options: TimelineRuntimeOptions;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly network: Network;
  readonly pageSize: number;
  readonly relays: readonly string[];
  readonly run: number;
  readonly isClosed: () => boolean;
  readonly isActive: (run: number) => boolean;
  readonly applyLoaded: (loaded: TimelineLoad) => void;
  readonly getCached: () => TimelineItem[];
  readonly emit: (next: TimelineState) => void;
  readonly withCursors: (next: TimelineState) => TimelineState;
  readonly getState: () => TimelineState;
  readonly getFollowList: () => TimelineLoad['followList'];
  readonly setCached: (items: TimelineItem[]) => void;
  readonly cleanup: () => (() => void)[];
}): Promise<void> {
  const pubkey = args.options.activeAccountPubkey;
  if (!pubkey) {
    const cached = await loadCachedTimeline(args.pageSize).catch(() => []);
    if (!args.isClosed()) {
      args.setCached(cached);
      args.emit(
        args.withCursors(noActiveAccountState(args.getState(), cached)),
      );
    }
    return;
  }
  const loaded = await loadCachedAccountHome(pubkey, args.pageSize).catch(
    () => ({
      authors: [],
      cached: [],
      profiles: {},
    }),
  );
  if (!args.isActive(args.run)) return;
  args.applyLoaded(loaded);
  const cached = args.getCached();
  const next =
    cached.length > 0
      ? readyWithEventsState(args.getState(), cached)
      : { ...args.getState(), items: cached };
  const seeded = args.options.seed
    ? {
        ...next,
        hasOlder: args.options.seed.hasOlder ?? next.hasOlder,
        hasNewer: args.options.seed.hasNewer ?? next.hasNewer,
      }
    : next;
  args.emit(args.withCursors(seeded));
  if (args.relays.length === 0)
    return args.emit(noEnabledRelayState(args.getState()));
  args
    .cleanup()
    .push(args.subscriptions.subscribeState(args.network.receiveState));
  if (args.getFollowList()) {
    await args.network.subscribeNotes();
    // Refresh follow-list in the background; follow-list absence decisions are
    // handled by bootstrap/read, not by subscription EOSE ambiguity.
    args.network.subscribe(
      'follows',
      [{ kinds: [3], authors: [pubkey], limit: 1 }],
      args.relays,
      'metadata',
    );
  } else {
    // Keep a live follow-list subscription so missing-follow decisions are
    // driven by follow-sub EOSE ownership, not by a best-effort read-page
    // timing window.
    args.network.subscribe(
      'follows',
      [{ kinds: [3], authors: [pubkey], limit: 1 }],
      args.relays,
      'metadata',
    );
    void args.network.bootstrapFollowList();
  }
}
