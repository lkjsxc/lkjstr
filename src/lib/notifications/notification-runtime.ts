import { lookupEvent, upsertEvent } from '../events/repository';
import { boundedErrorText } from '../events/runtime-error';
import { feedPageSize, feedWindowSize } from '../events/feed-window';
import type { FeedEvent } from '../events/types';
import {
  RelaySubscriptionManager,
  type RelaySubscriptionManager as SubscriptionManager,
} from '../relays/subscription-manager';
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
    await this.#reload(false);
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
          await upsertEvent(event, [relay]);
          await saveNotifications(
            deriveNotifications(this.accountPubkey!, event, [relay]),
          );
          await this.#reload(false);
        },
      ),
    );
  }

  async markVisibleRead(): Promise<void> {
    if (!this.accountPubkey) return;
    await markAccountNotificationsRead(this.accountPubkey);
    await this.#reload(false);
  }

  close(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#emit({ ...this.#state, loading: false, loadingOlder: false });
  }

  async loadOlder(): Promise<void> {
    if (
      !this.accountPubkey ||
      this.#state.loadingOlder ||
      !this.#state.hasOlder
    )
      return;
    const oldest = this.#state.records.at(-1)?.createdAt;
    if (!oldest) return;
    this.#emit({ ...this.#state, loadingOlder: true });
    try {
      const records = await accountNotifications(
        this.accountPubkey,
        this.#pageSize,
        oldest,
      );
      const until = this.#state.oldestCreatedAt;
      const relayEvents =
        until && this.relays.length > 0
          ? await this.subscriptions.readPage({
              key: `${this.subId}:older:${until}`,
              relays: this.relays,
              filters: [
                {
                  kinds: [0, 1, 6, 7],
                  '#p': [this.accountPubkey],
                  until,
                  limit: this.#pageSize,
                },
              ],
            })
          : [];
      for (const { event, relay } of relayEvents) {
        await upsertEvent(event, [relay]);
        await saveNotifications(
          deriveNotifications(this.accountPubkey, event, [relay]),
        );
      }
      await this.#reload(false, [...this.#state.records, ...records]);
      this.#emit({
        ...this.#state,
        hasOlder:
          records.length >= this.#pageSize ||
          relayEvents.length >= this.#pageSize,
      });
    } catch (error) {
      this.#emit({ ...this.#state, error: boundedErrorText(error) });
    } finally {
      if (this.#state.loadingOlder)
        this.#emit({ ...this.#state, loadingOlder: false });
    }
  }

  async #reload(
    loading = this.#state.loading,
    records?: readonly NotificationRecord[],
  ): Promise<void> {
    records ??= this.accountPubkey
      ? await accountNotifications(this.accountPubkey, this.#pageSize)
      : [];
    const ids = records.map((record) => record.sourceEventId);
    const items = (await Promise.all(ids.map((id) => lookupEvent(id)))).filter(
      (item): item is FeedEvent => Boolean(item),
    );
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
    this.#state = {
      ...state,
      oldestCreatedAt: state.items.at(-1)?.event.created_at,
    };
    this.#listeners.forEach((listener) => listener(this.#state));
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
