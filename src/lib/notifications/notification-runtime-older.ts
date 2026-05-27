import { upsertEvent } from '../events/repository';
import { deriveNotifications } from './notification-index';
import type { NotificationRecord } from './notification';
import {
  isWithinNotificationCursor,
  olderNotificationCursor,
} from './notification-paging';
import { notificationRelays } from './notification-relays';
import { buildNotificationFilters } from './notification-filters';
import { accountNotifications } from './notification-store';
import { saveNotifications } from './notification-store';
import { mergeNotificationReducerState } from './notification-reducer';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';

export async function loadOlderNotificationRelayPage(args: {
  readonly accountPubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly oldestCreatedAt: number;
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
}> {
  const cursor = olderNotificationCursor(args.oldestCreatedAt);
  const [localOlderRecords, selected] = await Promise.all([
    accountNotifications(
      args.accountPubkey,
      args.pageSize,
      args.oldestCreatedAt,
    ),
    notificationRelays(args.accountPubkey, args.relays),
  ]);

  const boundedLocalOlderRecords = localOlderRecords.filter(
    (record) => record.createdAt >= cursor.since,
  );

  const relayEvents =
    selected.length > 0
      ? (
          await args.subscriptions.readPageByIntent(
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
        ).events
      : [];

  const incomingRecords: NotificationRecord[] = [];
  for (const { event, relay } of relayEvents) {
    if (!args.active(args.run)) {
      return {
        mergedRecords: args.baseRecords,
        prunedNewer: false,
        hasOlder: false,
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

  return {
    mergedRecords: merged.records,
    prunedNewer: merged.prunedNewer,
    hasOlder:
      boundedLocalOlderRecords.length >= args.pageSize ||
      incomingRecords.length >= args.pageSize,
  };
}
