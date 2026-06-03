import { readRelayFeedGroups } from '../events/relay-page';
import { upsertEvent } from '../events/repository';
import { deriveNotifications } from './notification-index';
import type { NotificationRecord } from './notification';
import { olderNotificationCursor } from './notification-paging';
import type { HistoryExhaustion } from '../feed-surface/paging-state';
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
      ? await readRelayFeedGroups({
          key: notificationFeedKey(args.accountPubkey, selected, args.pageSize),
          semanticFeedKey: notificationFeedKey(
            args.accountPubkey,
            selected,
            args.pageSize,
          ),
          groups: [notificationGroup(args.accountPubkey, selected)],
          filters: (_group, bounds) =>
            buildNotificationFilters({
              accountPubkey: args.accountPubkey,
              limit: args.pageSize,
              cursor: bounds,
            }),
          direction: 'older',
          routeFingerprint: JSON.stringify([
            notificationGroup(args.accountPubkey, selected),
          ]),
          before: {
            createdAt: args.olderCursorCreatedAt,
            id: 'f'.repeat(64),
          },
          pageSize: args.pageSize,
          subscriptions: args.subscriptions,
          signal: args.signal,
          purpose: 'feed',
        })
      : {
          items: [],
          hasMorePossible: false,
          incomplete: false,
          dense: false,
        };

  const incomingRecords: NotificationRecord[] = [];
  for (const { event, relays } of relayPage.items) {
    if (!args.active(args.run)) {
      return {
        mergedRecords: args.baseRecords,
        prunedNewer: false,
        hasOlder: false,
        historyExhaustion: 'unknown',
        olderCursorCreatedAt: args.olderCursorCreatedAt,
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
    return (
      selected.length === 0 ||
      (!relayPage.incomplete && !relayPage.dense && !relayPage.hasMorePossible)
    );
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
