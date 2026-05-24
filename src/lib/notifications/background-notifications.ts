import { upsertEvent } from '$lib/events/repository';
import { accountNotifications, saveNotifications } from './notification-store';
import { deriveNotifications } from './notification-index';
import { notificationEventKinds } from './notification-runtime';
import { sharedSubscriptionManager } from '$lib/relays/subscription-manager';
import { initialRelaySubscriptionId } from '$lib/relays/subscription-id';
import { notificationRelays } from './notification-relays';

export type BackgroundNotificationSync = ReturnType<
  typeof createBackgroundNotificationSync
>;

export function createBackgroundNotificationSync(
  accountPubkey: string | undefined,
  relays: readonly string[],
  subscriptions = sharedSubscriptionManager,
  onStored: () => void = () => undefined,
) {
  const cleanup: (() => void)[] = [];
  let closed = false;
  const store = async (
    event: Parameters<typeof upsertEvent>[0],
    relay: string,
  ) => {
    if (closed || !accountPubkey) return;
    await upsertEvent(event, [relay]);
    const records = deriveNotifications(accountPubkey, event, [relay]);
    if (records.length === 0) return;
    await saveNotifications(records);
    onStored();
  };
  const readInitial = async (): Promise<void> => {
    const selected = await notificationRelays(accountPubkey!, relays);
    const events = await subscriptions.readPage({
      key: initialRelaySubscriptionId(
        'background-notifications',
        accountPubkey!,
      ),
      relays: selected,
      filters: [
        { kinds: notificationEventKinds, '#p': [accountPubkey!], limit: 50 },
      ],
      purpose: 'feed',
    });
    await Promise.all(events.map(({ event, relay }) => store(event, relay)));
  };
  return {
    start: async (): Promise<void> => {
      if (closed || !accountPubkey) return;
      await accountNotifications(accountPubkey);
      if (relays.length === 0 || closed) return;
      const selected = await notificationRelays(accountPubkey, relays);
      await readInitial();
      if (closed) return;
      cleanup.push(
        subscriptions.subscribeLive(
          {
            key: `background-notifications:${accountPubkey}`,
            relays: selected,
            filters: [
              {
                kinds: notificationEventKinds,
                '#p': [accountPubkey],
                since: Math.floor(Date.now() / 1000),
                limit: 50,
              },
            ],
            purpose: 'feed',
          },
          ({ event, relay }) => store(event, relay),
        ),
      );
    },
    close: (): void => {
      closed = true;
      cleanup.splice(0).forEach((item) => item());
    },
  };
}
