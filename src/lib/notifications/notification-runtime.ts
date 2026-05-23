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

export class NotificationRuntime {
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: NotificationState) => void>();
  #state: NotificationState = emptyNotificationState();
  #pageSize = feedPageSize;
  #startedAt = Math.floor(Date.now() / 1000);
  #closed = false;
  #generation = 0;

  constructor(
    readonly accountPubkey: string | undefined,
    readonly relays: readonly string[],
    readonly subId: string,
    readonly subscriptions: SubscriptionManager = sharedSubscriptionManager,
  ) {}

  subscribe(listener: (state: NotificationState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.#closed) return;
    const generation = ++this.#generation;
    await this.#reload(false);
    if (!this.#active(generation)) return;
    if (!this.accountPubkey || this.relays.length === 0) {
      this.#emit({ ...this.#state, loading: false });
      return;
    }
    await this.#readInitialRelayPage(generation);
    if (!this.#active(generation)) return;
    const relays = await notificationRelays(this.accountPubkey, this.relays);
    this.#cleanup.push(
      this.subscriptions.subscribeLive(
        {
          key: this.subId,
          relays,
          filters: [
            {
              kinds: notificationEventKinds,
              '#p': [this.accountPubkey],
              since: this.#startedAt,
              limit: this.#pageSize,
            },
          ],
          purpose: 'feed',
        },
        async ({ event, relay }) => {
          if (this.#closed) return;
          await upsertEvent(event, [relay]);
          if (this.#closed) return;
          await saveNotifications(
            deriveNotifications(this.accountPubkey!, event, [relay]),
          );
          await this.#reload(false);
        },
      ),
    );
  }

  async markVisibleRead(): Promise<void> {
    if (this.#closed || !this.accountPubkey) return;
    await markAccountNotificationsRead(this.accountPubkey);
    if (this.#closed) return;
    await this.#reload(false);
  }

  async #readInitialRelayPage(generation: number): Promise<void> {
    const relays = await notificationRelays(this.accountPubkey!, this.relays);
    const events = await this.subscriptions.readPage({
      key: `${this.subId}:initial`,
      relays,
      filters: [
        {
          kinds: notificationEventKinds,
          '#p': [this.accountPubkey!],
          limit: this.#pageSize,
        },
      ],
      purpose: 'feed',
    });
    for (const { event, relay } of events) {
      if (!this.#active(generation)) return;
      await upsertEvent(event, [relay]);
      await saveNotifications(
        deriveNotifications(this.accountPubkey!, event, [relay]),
      );
    }
    await this.#reload(false);
  }

  close(): void {
    this.#closed = true;
    this.#generation++;
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#listeners.clear();
  }

  // prettier-ignore
  async loadOlder(): Promise<void> {
    if (this.#closed || !this.accountPubkey || this.#state.loadingOlder || !this.#state.hasOlder) return; const oldest = this.#state.records.at(-1)?.createdAt; if (!oldest) return; const generation = this.#generation;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const records = await accountNotifications(this.accountPubkey, this.#pageSize, oldest); const until = this.#state.oldestCreatedAt; const relays = await notificationRelays(this.accountPubkey, this.relays);
      const relayEvents = until && relays.length > 0 ? await this.subscriptions.readPage({ key: olderRelaySubscriptionId(this.subId, until), relays, filters: [{ kinds: notificationEventKinds, '#p': [this.accountPubkey], since: Math.max(0, until - 30 * 24 * 60 * 60), until, limit: this.#pageSize }], purpose: 'feed' }) : [];
      for (const { event, relay } of relayEvents) { if (!this.#active(generation)) return; await upsertEvent(event, [relay]); await saveNotifications(deriveNotifications(this.accountPubkey, event, [relay])); }
      if (!this.#active(generation)) return; await this.#reload(false, [...this.#state.records, ...records]);
      this.#emit({ ...this.#state, hasOlder: records.length >= this.#pageSize || relayEvents.length >= this.#pageSize });
    } catch (error) { this.#emit({ ...this.#state, error: boundedErrorText(error) }); }
    finally { if (this.#state.loadingOlder) this.#emit({ ...this.#state, loadingOlder: false }); }
  }

  async #reload(
    loading = this.#state.loading,
    records?: readonly NotificationRecord[],
  ): Promise<void> {
    if (this.#closed) return;
    const generation = this.#generation;
    records ??= this.accountPubkey
      ? await accountNotifications(this.accountPubkey, this.#pageSize)
      : [];
    if (!this.#active(generation)) return;
    const [items, targetItems] = await Promise.all([
      lookupEvents(records.map((record) => record.sourceEventId)),
      lookupEvents(
        records
          .map(notificationContextEventId)
          .filter((id): id is string => Boolean(id)),
      ),
    ]);
    if (!this.#active(generation)) return;
    const pruned = items.length > feedWindowSize;
    this.#emit({
      ...this.#state,
      records: pruned ? records.slice(-feedWindowSize) : records,
      items: pruned ? items.slice(-feedWindowSize) : items,
      targetItems: pruned ? targetItems.slice(-feedWindowSize) : targetItems,
      loading,
      error: null,
      newerPruned: this.#state.newerPruned || pruned,
    });
  }

  #emit(state: NotificationState): void {
    if (this.#closed) return;
    this.#state = {
      ...state,
      oldestCreatedAt: state.items.at(-1)?.event.created_at,
    };
    this.#listeners.forEach((listener) => listener(this.#state));
  }

  #active(generation: number): boolean {
    return !this.#closed && generation === this.#generation;
  }
}
