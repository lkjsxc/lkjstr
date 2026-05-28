import { lookupEvents } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import { feedPageSize } from '../events/feed-window';
import {
  sharedSubscriptionOrchestrator,
  type SubscriptionOrchestrator,
} from '../relays/orchestration/orchestrator';
import type { DemandVisibility } from '../relays/orchestration/demand-types';
import type { NotificationRecord } from './notification';
import { notificationContextEventId } from './notification-presentation';
import {
  emptyNotificationState,
  type NotificationState,
} from './notification-state';
import {
  accountNotifications,
  markAccountNotificationsRead,
} from './notification-store';
import { trackNotificationRecords } from '../app/tab-runtime-counters';
import {
  notificationRecordWindowSize,
  windowNotifications,
} from './notification-window';
import { readInitialNotificationRelayPage } from './notification-runtime-initial';
import { loadOlderNotificationRelayPage } from './notification-runtime-older';
import {
  attachNotificationLiveSubscription,
  selectNotificationRelays,
} from './notification-runtime-live';
import { notificationEventKinds } from './notification-filters';
export { notificationEventKinds };
export type { NotificationState } from './notification-state';
export type NotificationRuntime = ReturnType<typeof createNotificationRuntime>;

export function createNotificationRuntime(
  accountPubkey: string | undefined,
  relays: readonly string[],
  subId: string,
  owner = subId,
  subscriptions: SubscriptionOrchestrator = sharedSubscriptionOrchestrator,
) {
  let visibility: DemandVisibility = 'visible';
  const cleanup: (() => void)[] = [];
  const listeners = new Set<(state: NotificationState) => void>();
  const pageSize = feedPageSize;
  const startedAt = Math.floor(Date.now() / 1000);
  const controller = new AbortController();
  let state: NotificationState = emptyNotificationState();
  let closed = false;
  let generation = 0;

  const active = (run: number): boolean => !closed && generation === run;
  const emit = (next: NotificationState): void => {
    if (closed) return;
    const oldestCreatedAt = next.records.at(-1)?.createdAt;
    state = {
      ...next,
      oldestCreatedAt,
      olderCursorCreatedAt:
        next.olderCursorCreatedAt ??
        state.olderCursorCreatedAt ??
        oldestCreatedAt,
      historyExhaustion: next.historyExhaustion ?? state.historyExhaustion,
    };
    trackNotificationRecords(next.records.length);
    listeners.forEach((listener) => listener(state));
  };
  const reload = async (
    loading = state.loading,
    records?: readonly NotificationRecord[],
    prunedNewerUpdate = false,
  ): Promise<void> => {
    if (closed) return;
    const run = generation;
    records ??= accountPubkey
      ? await accountNotifications(accountPubkey, notificationRecordWindowSize)
      : [];
    if (!active(run)) return;
    const [items, targetItems] = await Promise.all([
      lookupEvents(records.map((record) => record.sourceEventId)),
      lookupEvents(
        records.map(notificationContextEventId).filter(Boolean) as string[],
      ),
    ]);
    if (!active(run)) return;
    const window = windowNotifications({
      records,
      items,
      targetItems,
      limit: notificationRecordWindowSize,
    });
    emit({
      ...state,
      records: window.records,
      items: window.items,
      targetItems: window.targetItems,
      loading,
      error: null,
      newerPruned: state.newerPruned || prunedNewerUpdate || window.pruned,
    });
  };
  const readInitialRelayPage = async (run: number): Promise<void> => {
    const initial = await readInitialNotificationRelayPage({
      accountPubkey: accountPubkey!,
      relays,
      owner,
      pageSize,
      startedAt,
      subscriptions,
      signal: controller.signal,
      active,
      run,
      baseRecords: state.records,
      windowLimit: notificationRecordWindowSize,
    });
    if (!active(run)) return;
    await reload(false, initial.mergedRecords, initial.prunedNewer);
    if (!active(run)) return;
    emit({
      ...state,
      olderCursorCreatedAt:
        state.olderCursorCreatedAt ?? initial.olderCursorCreatedAt,
    });
  };
  // prettier-ignore
  const runtime = {
    subscribe: (listener: (state: NotificationState) => void): (() => void) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start: async (): Promise<void> => {
      if (closed) return; const run = ++generation; await reload(false); if (!active(run)) return;
      if (!accountPubkey || relays.length === 0) return emit({ ...state, loading: false });
      await readInitialRelayPage(run); if (!active(run)) return;
      const selected = await selectNotificationRelays(accountPubkey, relays);
      cleanup.push(
        await attachNotificationLiveSubscription({
          accountPubkey,
          relays: selected,
          owner,
          pageSize,
          startedAt,
          subscriptions,
          getVisibility: () => visibility,
          isClosed: () => closed,
          getState: () => state,
          reload,
        }),
      );
    },
    markVisibleRead: async (): Promise<void> => { if (closed || !accountPubkey) return; await markAccountNotificationsRead(accountPubkey); if (!closed) await reload(false); },
    loadOlder: async (): Promise<void> => {
      if (closed || !accountPubkey || state.loadingOlder || !state.hasOlder)
        return;
      const cursor = state.olderCursorCreatedAt ?? state.records.at(-1)?.createdAt;
      if (cursor === undefined) return;
      const run = generation;
      emit({ ...state, loadingOlder: true });
      try {
        const result = await loadOlderNotificationRelayPage({
          accountPubkey,
          relays,
          owner,
          pageSize,
          olderCursorCreatedAt: cursor,
          subscriptions,
          signal: controller.signal,
          active,
          run,
          baseRecords: state.records,
          windowLimit: notificationRecordWindowSize,
        });
        if (!active(run)) return;
        await reload(false, undefined, result.prunedNewer);
        emit({
          ...state,
          hasOlder: result.hasOlder,
          historyExhaustion: result.historyExhaustion,
          olderCursorCreatedAt: result.olderCursorCreatedAt,
        });
      } catch (error) {
        emit({ ...state, error: boundedErrorText(error) });
      } finally {
        if (state.loadingOlder) emit({ ...state, loadingOlder: false });
      }
    },
    setVisibility: (visible: boolean): void => {
      visibility = visible ? 'visible' : 'hidden';
      if (visible) subscriptions.resumeOwner(owner);
      else subscriptions.pauseOwner(owner);
    },
    close: (): void => {
      closed = true;
      generation++;
      controller.abort();
      subscriptions.releaseOwner(owner);
      for (const item of cleanup.splice(0)) item();
      listeners.clear();
      trackNotificationRecords(0);
    },
  };
  return runtime;
}
