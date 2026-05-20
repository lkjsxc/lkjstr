import type { RelaySnapshot } from '../relays/types';

export function threadRelayState(
  snapshots: readonly RelaySnapshot[],
  relays: readonly string[],
  subId: string,
): { eoseRelays: number; terminalRelays: number; activeRelays: number } {
  const active = snapshots.filter((item) => relays.includes(item.url));
  const eoseRelays = active.filter((item) => item.eoseBySub[subId]).length;
  const terminalRelays = active.filter(
    (item) =>
      item.eoseBySub[subId] ||
      item.closedBySub[subId] ||
      item.state === 'closed' ||
      item.state === 'error',
  ).length;
  return { eoseRelays, terminalRelays, activeRelays: active.length };
}
