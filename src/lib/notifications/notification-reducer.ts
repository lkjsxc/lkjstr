import type { NotificationRecord } from './notification';

export type NotificationReducerState = {
  readonly records: readonly NotificationRecord[];
  readonly prunedOlder: boolean;
  readonly prunedNewer: boolean;
};

export function createEmptyNotificationReducerState(): NotificationReducerState {
  return { records: [], prunedOlder: false, prunedNewer: false };
}

export function mergeNotificationReducerState(
  state: NotificationReducerState,
  incoming: readonly NotificationRecord[],
  limit: number,
): NotificationReducerState {
  const byId = new Map(state.records.map((record) => [record.id, record]));
  for (const record of incoming) byId.set(record.id, record);
  const recordsSorted = [...byId.values()]
    .sort(
      (left, right) =>
        right.createdAt - left.createdAt ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit);

  const keptIds = new Set(recordsSorted.map((record) => record.id));
  const prunedOlder =
    incoming.some((record) => !keptIds.has(record.id)) &&
    recordsSorted.length === limit;
  const prunedNewer = state.records.some((record) => !keptIds.has(record.id));

  return {
    records: recordsSorted,
    prunedOlder,
    prunedNewer,
  };
}
