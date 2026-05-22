import { upsertEvent } from '$lib/events/repository';
import { accountNotifications, saveNotifications } from './notification-store';
import { deriveNotifications } from './notification-index';
import { notificationEventKinds } from './notification-runtime';
import { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { initialRelaySubscriptionId } from '$lib/relays/subscription-id';

export class BackgroundNotificationSync {
  #cleanup: (() => void)[] = [];
  #closed = false;

  constructor(
    readonly accountPubkey: string | undefined,
    readonly relays: readonly string[],
    readonly subscriptions = new RelaySubscriptionManager(),
    readonly onStored: () => void = () => undefined,
  ) {}

  async start(): Promise<void> {
    if (this.#closed || !this.accountPubkey) return;
    await accountNotifications(this.accountPubkey);
    if (this.relays.length === 0 || this.#closed) return;
    await this.#readInitial();
    if (this.#closed) return;
    this.#cleanup.push(
      this.subscriptions.subscribeLive(
        {
          key: `background-notifications:${this.accountPubkey}`,
          relays: this.relays,
          filters: [
            {
              kinds: notificationEventKinds,
              '#p': [this.accountPubkey],
              since: Math.floor(Date.now() / 1000),
              limit: 50,
            },
          ],
        },
        ({ event, relay }) => this.#store(event, relay),
      ),
    );
  }

  close(): void {
    this.#closed = true;
    this.#cleanup.splice(0).forEach((cleanup) => cleanup());
  }

  async #readInitial(): Promise<void> {
    const events = await this.subscriptions.readPage({
      key: initialRelaySubscriptionId(
        'background-notifications',
        this.accountPubkey!,
      ),
      relays: this.relays,
      filters: [
        {
          kinds: notificationEventKinds,
          '#p': [this.accountPubkey!],
          limit: 50,
        },
      ],
    });
    await Promise.all(
      events.map(({ event, relay }) => this.#store(event, relay)),
    );
  }

  async #store(event: Parameters<typeof upsertEvent>[0], relay: string) {
    if (this.#closed || !this.accountPubkey) return;
    await upsertEvent(event, [relay]);
    const records = deriveNotifications(this.accountPubkey, event, [relay]);
    if (records.length === 0) return;
    await saveNotifications(records);
    this.onStored();
  }
}
