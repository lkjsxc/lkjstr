import { lookupEvent, upsertEvent } from '../events/repository';
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
};

export class NotificationRuntime {
  #cleanup: (() => void)[] = [];
  #listeners = new Set<(state: NotificationState) => void>();
  #state: NotificationState = emptyState();

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
              kinds: [1, 3, 6, 7],
              '#p': [this.accountPubkey],
              limit: 50,
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
    this.#emit({ ...this.#state, loading: false });
  }

  async #reload(loading = this.#state.loading): Promise<void> {
    const records = this.accountPubkey
      ? await accountNotifications(this.accountPubkey)
      : [];
    const ids = records.map((record) => record.sourceEventId);
    const items = (await Promise.all(ids.map((id) => lookupEvent(id)))).filter(
      (item): item is FeedEvent => Boolean(item),
    );
    this.#emit({ records, items, loading, error: null });
  }

  #emit(state: NotificationState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
  }
}

function emptyState(): NotificationState {
  return { records: [], items: [], loading: true, error: null };
}
