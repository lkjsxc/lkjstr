import type { RelayDiagnostic, RelaySnapshot } from '../relays/types';
import type { TimelineStatus } from './timeline-state';

export function subscriptionEose(item: RelaySnapshot, subId: string): boolean {
  if (item.eoseBySub[subId]) return true;
  return Object.entries(item.eoseBySub).some(
    ([id, done]) => done && id.includes(subId.split(':').at(-1) ?? subId),
  );
}

export function statusFromRelayState(
  active: readonly RelaySnapshot[],
  diagnostics: readonly RelayDiagnostic[],
  hasItems: boolean,
  noFollowList: boolean,
  noteSubId: string,
): TimelineStatus {
  if (hasItems) return 'ready-with-events';
  if (noFollowList) return 'no-follow-list';
  if (
    active.some(
      (item) =>
        subscriptionEose(item, noteSubId) ||
        Object.values(item.eoseBySub).some(Boolean),
    )
  ) {
    return 'ready-empty';
  }
  if (active.length === 0) return 'loading-follows';
  if (!active.every((item) => isTerminalSubscription(item, noteSubId)))
    return 'loading-follows';
  if (diagnostics.some((item) => item.kind === 'auth')) return 'auth-required';
  if (active.some((item) => item.closedBySub[noteSubId]))
    return 'subscription-closed';
  return 'relay-failed';
}

export function relaySnapshotCounts(
  active: readonly RelaySnapshot[],
  noteSubId: string,
): { connectedRelays: number; eoseRelays: number } {
  return {
    connectedRelays: active.filter((item) => item.state === 'open').length,
    eoseRelays: active.filter(
      (item) =>
        subscriptionEose(item, noteSubId) ||
        Object.values(item.eoseBySub).some(Boolean),
    ).length,
  };
}

function isTerminalSubscription(item: RelaySnapshot, subId: string): boolean {
  return isTerminalRelay(item) || Boolean(item.closedBySub[subId]);
}

function isTerminalRelay(item: RelaySnapshot): boolean {
  return item.state === 'error' || item.state === 'closed';
}
