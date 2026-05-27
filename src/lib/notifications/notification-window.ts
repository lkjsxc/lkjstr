import type { FeedEvent } from '../events/types';
import { notificationContextEventId } from './notification-presentation';
import type { NotificationRecord } from './notification';

export const notificationRecordWindowSize = 180;

export type NotificationWindowInput = {
  readonly records: readonly NotificationRecord[];
  readonly items: readonly FeedEvent[];
  readonly targetItems: readonly FeedEvent[];
  readonly limit?: number;
};

export type NotificationWindow = {
  readonly records: readonly NotificationRecord[];
  readonly items: readonly FeedEvent[];
  readonly targetItems: readonly FeedEvent[];
  readonly pruned: boolean;
};

export function windowNotifications(
  input: NotificationWindowInput,
): NotificationWindow {
  const limit = Math.max(
    1,
    Math.floor(input.limit ?? notificationRecordWindowSize),
  );
  const pruned = input.records.length > limit;
  // `records` are expected to be sorted newest-first. Keep the newest window.
  const records = pruned ? input.records.slice(0, limit) : [...input.records];
  const sourceIds = new Set(records.map((record) => record.sourceEventId));
  const targetIds = new Set(
    records
      .map(notificationContextEventId)
      .filter((id): id is string => Boolean(id)),
  );
  return {
    records,
    items: retainReferenced(input.items, sourceIds),
    targetItems: retainReferenced(input.targetItems, targetIds),
    pruned,
  };
}

function retainReferenced(
  items: readonly FeedEvent[],
  ids: ReadonlySet<string>,
): FeedEvent[] {
  return items.filter((item) => ids.has(item.event.id));
}
