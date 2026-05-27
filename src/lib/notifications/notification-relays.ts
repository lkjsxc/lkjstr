import { planAuthorReadRelays } from '../relays/orchestration/route-plan';

export function notificationRelays(
  accountPubkey: string,
  selectedRelays: readonly string[],
): Promise<string[]> {
  return planAuthorReadRelays({
    authors: [accountPubkey],
    selectedRelays,
  });
}
