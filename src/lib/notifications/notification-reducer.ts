import type { NotificationRecord } from './notification';

export type NotificationReducerState = {
  readonly records: readonly NotificationRecord[];
};

export function createEmptyNotificationReducerState(): NotificationReducerState {
  return { records: [] };
}

export function mergeNotificationReducerState(
  state: NotificationReducerState,
  incoming: readonly NotificationRecord[],
  limit: number,
): NotificationReducerState {
  const byId = new Map(state.records.map((record) => [record.id, record]));
  for (const record of incoming) byId.set(record.id, record);
  const records = [...byId.values()]
    .sort(
      (left, right) =>
        right.createdAt - left.createdAt ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit);
  return { records };
}
