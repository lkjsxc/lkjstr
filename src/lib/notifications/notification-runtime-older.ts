import { upsertEvent } from '../events/repository';
import { deriveNotifications } from './notification-index';
import type { NotificationRecord } from './notification';
import {
  isWithinNotificationCursor,
  olderNotificationCursor,
} from './notification-paging';
import type { HistoryExhaustion } from '../feed-surface/paging-state';
import { notificationRelays } from './notification-relays';
import { buildNotificationFilters } from './notification-filters';
import { accountNotifications } from './notification-store';
import { saveNotifications } from './notification-store';
import { mergeNotificationReducerState } from './notification-reducer';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { statusesComplete } from '../events/relay-page-status';

export async function loadOlderNotificationRelayPage(args: {
  readonly accountPubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly olderCursorCreatedAt: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly active: (run: number) => boolean;
  readonly run: number;
  readonly baseRecords: readonly NotificationRecord[];
  readonly windowLimit: number;
}): Promise<{
  readonly mergedRecords: readonly NotificationRecord[];
  readonly prunedNewer: boolean;
  readonly hasOlder: boolean;
  readonly historyExhaustion: HistoryExhaustion;
  readonly olderCursorCreatedAt: number;
}> {
  const cursor = olderNotificationCursor(args.olderCursorCreatedAt);
  const [localOlderRecords, selected] = await Promise.all([
    accountNotifications(
      args.accountPubkey,
      args.pageSize,
      args.olderCursorCreatedAt,
    ),
    notificationRelays(args.accountPubkey, args.relays),
  ]);

  const boundedLocalOlderRecords = localOlderRecords.filter(
    (record) => record.createdAt >= cursor.since,
  );

  const relayPage =
    selected.length > 0
      ? await args.subscriptions.readPageByIntent(
          {
            surface: 'notifications',
            owner: args.owner,
            phase: 'page',
            selectedRelays: selected,
            authors: [args.accountPubkey],
            pageSize: args.pageSize,
            direction: 'older',
            cursor: { createdAt: cursor.until, id: '' },
            relayFilters: buildNotificationFilters({
              accountPubkey: args.accountPubkey,
              limit: args.pageSize,
              cursor,
            }),
            purpose: 'feed',
          },
          { signal: args.signal },
        )
      : { events: [], statuses: [] };
  const relayEvents = relayPage.events;

  const incomingRecords: NotificationRecord[] = [];
  for (const { event, relay } of relayEvents) {
    if (!args.active(args.run)) {
      return {
        mergedRecords: args.baseRecords,
        prunedNewer: false,
        hasOlder: false,
        historyExhaustion: 'unknown',
        olderCursorCreatedAt: args.olderCursorCreatedAt,
      };
    }
    if (!isWithinNotificationCursor(event.created_at, cursor)) continue;
    const derived = deriveNotifications(args.accountPubkey, event, [relay]);
    if (derived.length === 0) continue;
    await upsertEvent(event, [relay]);
    incomingRecords.push(...derived);
    await saveNotifications(derived);
  }

  const merged = mergeNotificationReducerState(
    {
      records: args.baseRecords,
      prunedOlder: false,
      prunedNewer: false,
    },
    [...boundedLocalOlderRecords, ...incomingRecords],
    args.windowLimit,
  );
  const nextCursor = nextScanCursor();
  const exhaustion = exhaustionState(nextCursor);

  return {
    mergedRecords: merged.records,
    prunedNewer: merged.prunedNewer,
    hasOlder: exhaustion !== 'proven',
    historyExhaustion: exhaustion,
    olderCursorCreatedAt: nextCursor,
  };

  function relayReadComplete(): boolean {
    return selected.length === 0 || statusesComplete(relayPage.statuses);
  }

  function nextScanCursor(): number {
    const oldest = merged.records.at(-1)?.createdAt;
    if (
      oldest &&
      (incomingRecords.length > 0 || boundedLocalOlderRecords.length > 0)
    )
      return oldest;
    return relayReadComplete() ? cursor.since : args.olderCursorCreatedAt;
  }

  function exhaustionState(nextCursorCreatedAt: number): HistoryExhaustion {
    if (
      cursor.since === 0 &&
      localOlderRecords.length === 0 &&
      relayReadComplete()
    )
      return 'proven';
    return nextCursorCreatedAt === args.olderCursorCreatedAt
      ? 'unknown'
      : 'probing';
  }
}
