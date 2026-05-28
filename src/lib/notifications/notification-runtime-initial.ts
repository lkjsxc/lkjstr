import { upsertEvent } from '../events/repository';
import { deriveNotifications } from './notification-index';
import type { NotificationRecord } from './notification';
import {
  initialNotificationCursor,
  isWithinNotificationCursor,
} from './notification-paging';
import { notificationRelays } from './notification-relays';
import { buildNotificationFilters } from './notification-filters';
import { saveNotifications } from './notification-store';
import { mergeNotificationReducerState } from './notification-reducer';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';

export async function readInitialNotificationRelayPage(args: {
  readonly accountPubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly startedAt: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly active: (run: number) => boolean;
  readonly run: number;
  readonly baseRecords: readonly NotificationRecord[];
  readonly windowLimit: number;
}): Promise<{
  readonly mergedRecords: readonly NotificationRecord[];
  readonly prunedNewer: boolean;
  readonly olderCursorCreatedAt: number;
}> {
  const cursor = initialNotificationCursor(args.startedAt);
  const selected = await notificationRelays(args.accountPubkey, args.relays);
  const filters = buildNotificationFilters({
    accountPubkey: args.accountPubkey,
    limit: args.pageSize,
    cursor,
  });
  const pageIntent = {
    surface: 'notifications' as const,
    owner: args.owner,
    phase: 'bootstrap' as const,
    selectedRelays: selected,
    authors: [args.accountPubkey],
    pageSize: args.pageSize,
    direction: 'initial' as const,
    relayFilters: filters,
    purpose: 'feed' as const,
  };
  const { events } = await args.subscriptions.readPageByIntent(pageIntent, {
    signal: args.signal,
  });

  const incomingRecords: NotificationRecord[] = [];
  for (const { event, relay } of events) {
    if (!args.active(args.run)) {
      return {
        mergedRecords: args.baseRecords,
        prunedNewer: false,
        olderCursorCreatedAt:
          args.baseRecords.at(-1)?.createdAt ?? cursor.since,
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
    incomingRecords,
    args.windowLimit,
  );

  return {
    mergedRecords: merged.records,
    prunedNewer: merged.prunedNewer,
    olderCursorCreatedAt: merged.records.at(-1)?.createdAt ?? cursor.since,
  };
}
