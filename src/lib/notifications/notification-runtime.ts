import { lookupEvents, upsertEvent } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import { feedPageSize, feedWindowSize } from '../events/feed-window';
import {
  sharedSubscriptionManager,
  type RelaySubscriptionManager as SubscriptionManager,
} from '../relays/subscription-manager';
import { olderRelaySubscriptionId } from '../relays/subscription-id';
import { deriveNotifications } from './notification-index';
import type { NotificationRecord } from './notification';
import { notificationContextEventId } from './notification-presentation';
import { notificationRelays } from './notification-relays';
import {
  emptyNotificationState,
  type NotificationState,
} from './notification-state';
import {
  accountNotifications,
  markAccountNotificationsRead,
  saveNotifications,
} from './notification-store';

export const notificationEventKinds = [0, 1, 6, 7, 16, 9735] as const;
export type { NotificationState } from './notification-state';
export type NotificationRuntime = ReturnType<typeof createNotificationRuntime>;

export function createNotificationRuntime(
  accountPubkey: string | undefined,
  relays: readonly string[],
  subId: string,
  subscriptions: SubscriptionManager = sharedSubscriptionManager,
) {
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
    state = { ...next, oldestCreatedAt: next.items.at(-1)?.event.created_at };
    listeners.forEach((listener) => listener(state));
  };
  const reload = async (
    loading = state.loading,
    records?: readonly NotificationRecord[],
  ): Promise<void> => {
    if (closed) return;
    const run = generation;
    records ??= accountPubkey
      ? await accountNotifications(accountPubkey, pageSize)
      : [];
    if (!active(run)) return;
    const [items, targetItems] = await Promise.all([
      lookupEvents(records.map((record) => record.sourceEventId)),
      lookupEvents(
        records.map(notificationContextEventId).filter(Boolean) as string[],
      ),
    ]);
    if (!active(run)) return;
    const pruned = items.length > feedWindowSize;
    emit({
      ...state,
      records: pruned ? records.slice(-feedWindowSize) : records,
      items: pruned ? items.slice(-feedWindowSize) : items,
      targetItems: pruned ? targetItems.slice(-feedWindowSize) : targetItems,
      loading,
      error: null,
      newerPruned: state.newerPruned || pruned,
    });
  };
  // prettier-ignore
  const readInitialRelayPage = async (run: number): Promise<void> => {
    const selected = await notificationRelays(accountPubkey!, relays);
    const events = await subscriptions.readPage({ key: `${subId}:initial`, relays: selected, filters: [{ kinds: notificationEventKinds, '#p': [accountPubkey!], limit: pageSize }], purpose: 'feed' }, { signal: controller.signal });
    for (const { event, relay } of events) {
      if (!active(run)) return;
      await upsertEvent(event, [relay]);
      await saveNotifications(deriveNotifications(accountPubkey!, event, [relay]));
    }
    await reload(false);
  };

  // prettier-ignore
  const runtime = {
    subscribe: (listener: (state: NotificationState) => void): (() => void) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start: async (): Promise<void> => {
      if (closed) return; const run = ++generation; await reload(false); if (!active(run)) return;
      if (!accountPubkey || relays.length === 0) return emit({ ...state, loading: false });
      await readInitialRelayPage(run); if (!active(run)) return;
      const selected = await notificationRelays(accountPubkey, relays);
      cleanup.push(subscriptions.subscribeLive({ key: subId, relays: selected, filters: [{ kinds: notificationEventKinds, '#p': [accountPubkey], since: startedAt, limit: pageSize }], purpose: 'feed' }, async ({ event, relay }) => {
        if (closed) return; await upsertEvent(event, [relay]); if (closed) return; await saveNotifications(deriveNotifications(accountPubkey, event, [relay])); await reload(false);
      }));
    },
    markVisibleRead: async (): Promise<void> => { if (closed || !accountPubkey) return; await markAccountNotificationsRead(accountPubkey); if (!closed) await reload(false); },
    loadOlder: async (): Promise<void> => {
      if (closed || !accountPubkey || state.loadingOlder || !state.hasOlder) return; const oldest = state.records.at(-1)?.createdAt; if (!oldest) return; const run = generation; emit({ ...state, loadingOlder: true });
      try {
        const records = await accountNotifications(accountPubkey, pageSize, oldest); const until = state.oldestCreatedAt; const selected = await notificationRelays(accountPubkey, relays);
        const relayEvents = until && selected.length > 0 ? await subscriptions.readPage({ key: olderRelaySubscriptionId(subId, until), relays: selected, filters: [{ kinds: notificationEventKinds, '#p': [accountPubkey], since: Math.max(0, until - 2592000), until, limit: pageSize }], purpose: 'feed' }, { signal: controller.signal }) : [];
        for (const { event, relay } of relayEvents) { if (!active(run)) return; await upsertEvent(event, [relay]); await saveNotifications(deriveNotifications(accountPubkey, event, [relay])); }
        if (!active(run)) return; await reload(false, [...state.records, ...records]); emit({ ...state, hasOlder: records.length >= pageSize || relayEvents.length >= pageSize });
      } catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingOlder) emit({ ...state, loadingOlder: false }); }
    },
    close: (): void => { closed = true; generation++; controller.abort(); for (const item of cleanup.splice(0)) item(); listeners.clear(); },
  };
  return runtime;
}
