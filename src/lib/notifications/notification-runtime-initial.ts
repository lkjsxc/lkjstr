import { readRelayFeedGroups } from '../events/relay-page';
import { upsertEvent } from '../events/repository';
import { deriveNotifications } from './notification-index';
import type { NotificationRecord } from './notification';
import { initialNotificationCursor } from './notification-paging';
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
  const page =
    selected.length > 0
      ? await readRelayFeedGroups({
          key: notificationFeedKey(args.accountPubkey, selected, args.pageSize),
          groups: [notificationGroup(args.accountPubkey, selected)],
          filters: (_group, bounds) =>
            buildNotificationFilters({
              accountPubkey: args.accountPubkey,
              limit: args.pageSize,
              cursor: bounds,
            }),
          direction: 'initial',
          before: { createdAt: cursor.until - 1, id: 'f'.repeat(64) },
          pageSize: args.pageSize,
          subscriptions: args.subscriptions,
          signal: args.signal,
          purpose: 'feed',
        })
      : { items: [], hasMorePossible: false };

  const incomingRecords: NotificationRecord[] = [];
  for (const { event, relays } of page.items) {
    if (!args.active(args.run)) {
      return {
        mergedRecords: args.baseRecords,
        prunedNewer: false,
        olderCursorCreatedAt:
          args.baseRecords.at(-1)?.createdAt ?? cursor.since,
      };
    }
    const derived = deriveNotifications(args.accountPubkey, event, relays);
    if (derived.length === 0) continue;
    await upsertEvent(event, relays);
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

function notificationFeedKey(
  accountPubkey: string,
  relays: readonly string[],
  pageSize: number,
): string {
  return `notifications:${accountPubkey}:${pageSize}:${[...relays].sort().join(',')}`;
}

function notificationGroup(accountPubkey: string, relays: readonly string[]) {
  return {
    key: `notifications:${accountPubkey}`,
    relays,
    authors: [],
    source: 'selected' as const,
  };
}
