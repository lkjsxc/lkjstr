import { routedAuthorRelays } from '../relays/relay-routing';

export function notificationRelays(
  accountPubkey: string,
  selectedRelays: readonly string[],
): Promise<string[]> {
  return routedAuthorRelays({
    authors: [accountPubkey],
    selectedRelays,
    purpose: 'read',
  });
}
