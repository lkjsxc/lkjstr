import { upsertEvent } from '../events/repository';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { DemandVisibility } from '../relays/orchestration/demand-types';
import { deriveNotifications } from './notification-index';
import { buildNotificationFilters } from './notification-filters';
import { saveNotifications } from './notification-store';
import { mergeNotificationReducerState } from './notification-reducer';
import { notificationRecordWindowSize } from './notification-window';
import { notificationRelays } from './notification-relays';
import type { NotificationRecord } from './notification';
import type { NotificationState } from './notification-state';

export async function attachNotificationLiveSubscription(args: {
  readonly accountPubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly startedAt: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly getVisibility: () => DemandVisibility;
  readonly isClosed: () => boolean;
  readonly getState: () => NotificationState;
  readonly reload: (
    loading?: boolean,
    records?: readonly NotificationRecord[],
    prunedNewerUpdate?: boolean,
  ) => Promise<void>;
}): Promise<() => void> {
  const selected = await notificationRelays(args.accountPubkey, args.relays);
  return args.subscriptions.submitLiveIntent(
    {
      surface: 'notifications',
      owner: args.owner,
      channel: 'notifications:live',
      visibility: args.getVisibility(),
      selectedRelays: selected,
      filters: buildNotificationFilters({
        accountPubkey: args.accountPubkey,
        limit: args.pageSize,
        cursor: { since: args.startedAt },
      }),
      purpose: 'feed',
      since: args.startedAt,
    },
    selected,
    async ({ event, relay }) => {
      if (args.isClosed()) return;
      if (event.created_at < args.startedAt) return;
      const incoming = deriveNotifications(args.accountPubkey, event, [relay]);
      if (incoming.length === 0) return;
      await upsertEvent(event, [relay]);
      if (args.isClosed()) return;
      await saveNotifications(incoming);
      const merged = mergeNotificationReducerState(
        {
          records: args.getState().records,
          prunedOlder: false,
          prunedNewer: false,
        },
        incoming,
        notificationRecordWindowSize,
      );
      await args.reload(false, merged.records, merged.prunedNewer);
    },
  );
}

export async function selectNotificationRelays(
  accountPubkey: string,
  relays: readonly string[],
): Promise<readonly string[]> {
  return notificationRelays(accountPubkey, relays);
}
