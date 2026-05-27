import type { RelayDiagnostic, RelaySnapshot } from '../relays/types';
import type { TimelineStatus } from './timeline-state';

function subSuffix(subId: string): string {
  return subId.split(':').at(-1) ?? subId;
}

function matchesOrchestratedNotesLease(id: string, subId: string): boolean {
  return subSuffix(subId) === 'notes' && id.startsWith('lease:');
}

export function subscriptionEose(item: RelaySnapshot, subId: string): boolean {
  if (item.eoseBySub[subId]) return true;
  const suffix = subSuffix(subId);
  return Object.entries(item.eoseBySub).some(
    ([id, done]) =>
      done && (id.includes(suffix) || matchesOrchestratedNotesLease(id, subId)),
  );
}

function subscriptionClosed(item: RelaySnapshot, subId: string): boolean {
  if (item.closedBySub[subId]) return true;
  const suffix = subSuffix(subId);
  return Object.entries(item.closedBySub).some(
    ([id, reason]) =>
      Boolean(reason) &&
      (id.includes(suffix) || matchesOrchestratedNotesLease(id, subId)),
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
  if (active.some((item) => subscriptionEose(item, noteSubId))) {
    return 'ready-empty';
  }
  if (active.length === 0) return 'loading-follows';
  if (!active.every((item) => isTerminalSubscription(item, noteSubId)))
    return 'loading-follows';
  if (diagnostics.some((item) => item.kind === 'auth')) return 'auth-required';
  if (active.some((item) => subscriptionClosed(item, noteSubId)))
    return 'subscription-closed';
  return 'relay-failed';
}

export function relaySnapshotCounts(
  active: readonly RelaySnapshot[],
  noteSubId: string,
): { connectedRelays: number; eoseRelays: number } {
  return {
    connectedRelays: active.filter((item) => item.state === 'open').length,
    eoseRelays: active.filter((item) => subscriptionEose(item, noteSubId))
      .length,
  };
}

function isTerminalSubscription(item: RelaySnapshot, subId: string): boolean {
  return (
    isTerminalRelay(item) ||
    subscriptionClosed(item, subId) ||
    subscriptionEose(item, subId)
  );
}

function isTerminalRelay(item: RelaySnapshot): boolean {
  return item.state === 'error' || item.state === 'closed';
}
