import type { FeedEvent } from '../events/types';
import type { NotificationRecord } from './notification';

export type NotificationState = {
  readonly records: readonly NotificationRecord[];
  readonly items: readonly FeedEvent[];
  readonly targetItems: readonly FeedEvent[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly oldestCreatedAt?: number;
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
    oldestCreatedAt: undefined,
    newerPruned: false,
  };
}
