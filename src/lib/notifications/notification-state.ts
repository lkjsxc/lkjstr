import type { FeedEvent } from '../events/types';
import type { HistoryExhaustion } from '../feed-surface/paging-state';
import type { NotificationRecord } from './notification';

export type NotificationState = {
  readonly records: readonly NotificationRecord[];
  readonly items: readonly FeedEvent[];
  readonly targetItems: readonly FeedEvent[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly historyExhaustion: HistoryExhaustion;
  readonly oldestCreatedAt?: number;
  readonly olderCursorCreatedAt?: number;
  readonly newerPruned: boolean;
};

export function emptyNotificationState(): NotificationState {
  return {
    records: [],
    items: [],
    targetItems: [],
    loading: true,
    error: null,
    loadingOlder: false,
    hasOlder: true,
    historyExhaustion: 'unknown',
    oldestCreatedAt: undefined,
    olderCursorCreatedAt: undefined,
    newerPruned: false,
  };
}
