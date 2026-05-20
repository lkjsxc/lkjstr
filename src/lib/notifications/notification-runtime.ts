import { lookupEvents, upsertEvent } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import { feedPageSize, feedWindowSize } from '../events/feed-window';
import type { FeedEvent } from '../events/types';
import {
  RelaySubscriptionManager,
  type RelaySubscriptionManager as SubscriptionManager,
} from '../relays/subscription-manager';
import { olderRelaySubscriptionId } from '../relays/subscription-id';
import { deriveNotifications } from './notification-index';
import type { NotificationRecord } from './notification';
import {
  accountNotifications,
  markAccountNotificationsRead,
  saveNotifications,
} from './notification-store';

export type NotificationState = {
  readonly records: readonly NotificationRecord[];
  readonly items: readonly FeedEvent[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly oldestCreatedAt?: number;
  readonly newerPruned: boolean;
};

export class NotificationRuntime {
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: NotificationState) => void>();
  #state: NotificationState = emptyState();
  #pageSize = feedPageSize;
  #startedAt = Math.floor(Date.now() / 1000);
  #closed = false;
  #generation = 0;

  constructor(
    readonly accountPubkey: string | undefined,
    readonly relays: readonly string[],
    readonly subId: string,
    readonly subscriptions: SubscriptionManager = new RelaySubscriptionManager(),
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
    this.#cleanup.push(
      this.subscriptions.subscribeLive(
        {
          key: this.subId,
          relays: this.relays,
          filters: [
            {
              kinds: [0, 1, 6, 7],
              '#p': [this.accountPubkey],
              since: this.#startedAt,
              limit: this.#pageSize,
            },
          ],
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
      const records = await accountNotifications(this.accountPubkey, this.#pageSize, oldest); const until = this.#state.oldestCreatedAt;
      const relayEvents = until && this.relays.length > 0 ? await this.subscriptions.readPage({ key: olderRelaySubscriptionId(this.subId, until), relays: this.relays, filters: [{ kinds: [0, 1, 6, 7], '#p': [this.accountPubkey], until, limit: this.#pageSize }] }) : [];
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
    const items = await lookupEvents(
      records.map((record) => record.sourceEventId),
    );
    if (!this.#active(generation)) return;
    const pruned = items.length > feedWindowSize;
    this.#emit({
      ...this.#state,
      records: pruned ? records.slice(-feedWindowSize) : records,
      items: pruned ? items.slice(-feedWindowSize) : items,
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

function emptyState(): NotificationState {
  return {
    records: [],
    items: [],
    loading: true,
    error: null,
    loadingOlder: false,
    hasOlder: true,
    oldestCreatedAt: undefined,
    newerPruned: false,
  };
}
