import { feedWindowSize } from '../events/feed-window';
import { loadOlderTimelinePage } from './timeline-runtime-paging';
import { mergeTimelineItems, type TimelineItem } from './timeline-store';
import type { TimelineState } from './timeline-state';

export async function runTimelineLoadOlder(args: {
  readonly items: () => TimelineItem[];
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly subId: string;
  readonly cursor: { createdAt: number; id: string };
  readonly pageSize: number;
  readonly subscriptions: Parameters<
    typeof loadOlderTimelinePage
  >[0]['subscriptions'];
  readonly signal: AbortSignal;
  readonly state: TimelineState;
  readonly emit: (next: TimelineState) => void;
  readonly nextState: (patch: Partial<TimelineState>) => TimelineState;
  readonly setCached: (items: TimelineItem[]) => void;
  readonly clearLive: () => void;
  readonly setOlderScanCursor: (
    cursor: { createdAt: number; id: string } | undefined,
  ) => void;
}): Promise<void> {
  const page = await loadOlderTimelinePage({
    items: args.items(),
    authors: args.authors,
    relays: args.relays,
    subId: args.subId,
    cursor: args.cursor,
    pageSize: args.pageSize,
    subscriptions: args.subscriptions,
    signal: args.signal,
  });
  args.setCached(
    mergeTimelineItems(page.items, args.items(), feedWindowSize),
  );
  args.clearLive();
  args.setOlderScanCursor(page.hasOlder ? page.nextOlderCursor : undefined);
  args.emit(
    args.nextState({
      items: args.items(),
      hasOlder: page.hasOlder,
      hasNewer: args.state.hasNewer || page.hasNewer,
    }),
  );
}
