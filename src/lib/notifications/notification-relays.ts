import { planAuthorReadRelays } from '../relays/orchestration/route-plan';

export function notificationRelays(
  accountPubkey: string,
  selectedRelays: readonly string[],
): Promise<string[]> {
  return planAuthorReadRelays({
    authors: [accountPubkey],
    selectedRelays,
  }).then((planned) => {
    const relays = planned.length > 0 ? planned : selectedRelays;
    return [...new Set(relays)];
  });
}
