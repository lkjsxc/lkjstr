import type { NostrEvent } from '../protocol';
import type { RelayPool } from '../relays/relay-pool';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import type { RelayDiagnostic, RelaySnapshot } from '../relays/types';
import type { TimelineProfiles } from './timeline-profiles';
import type { TimelineItem } from './timeline-store';

export type TimelineStatus =
  | 'no-active-account'
  | 'loading-follows'
  | 'no-follow-list'
  | 'no-enabled-relay'
  | 'auth-required'
  | 'subscription-closed'
  | 'relay-failed'
  | 'ready-empty'
  | 'ready-with-events';

export type TimelineState = {
  readonly items: readonly TimelineItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly status: TimelineStatus;
  readonly connectedRelays: number;
  readonly eoseRelays: number;
  readonly authors: readonly string[];
  readonly profiles: TimelineProfiles;
  readonly diagnostics: readonly RelayDiagnostic[];
};

export type TimelineRuntimeOptions = {
  readonly relays: readonly string[];
  readonly subId: string;
  readonly kind?: 'home' | 'global';
  readonly activeAccountPubkey?: string | null;
  readonly limit?: number;
  readonly pool?: RelayPool;
  readonly subscriptions?: RelaySubscriptionManager;
};

export function upsertLive(
  items: readonly TimelineItem[],
  event: NostrEvent,
  relay: string,
): TimelineItem[] {
  const existing = items.find((item) => item.event.id === event.id);
  if (!existing) return [...items, { event, relays: [relay] }];
  return items.map((item) =>
    item.event.id === event.id
      ? { event, relays: [...new Set([...item.relays, relay])] }
      : item,
  );
}

export function errorFor(status: TimelineStatus): string | null {
  const errors: Partial<Record<TimelineStatus, string>> = {
    'no-enabled-relay': 'No enabled read relays.',
    'auth-required': 'A relay requires authentication.',
    'subscription-closed': 'A relay closed the timeline subscription.',
    'relay-failed': 'No relay is reachable.',
    'no-follow-list': 'No follow list found; showing account notes only.',
  };
  return errors[status] ?? null;
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
  if (active.some((item) => item.eoseBySub[noteSubId])) return 'ready-empty';
  if (active.length === 0) return 'loading-follows';
  if (!active.every(isTerminalRelay)) return 'loading-follows';
  if (diagnostics.some((item) => item.kind === 'auth')) return 'auth-required';
  if (diagnostics.some((item) => item.kind === 'closed'))
    return 'subscription-closed';
  return 'relay-failed';
}

export function relaySnapshotCounts(
  active: readonly RelaySnapshot[],
  noteSubId: string,
): { connectedRelays: number; eoseRelays: number } {
  return {
    connectedRelays: active.filter((item) => item.state === 'open').length,
    eoseRelays: active.filter((item) => item.eoseBySub[noteSubId]).length,
  };
}

export function missingFollowAfterEose(
  active: readonly RelaySnapshot[],
  followListFound: boolean,
  fallbackStarted: boolean,
  followSubId: string,
): boolean {
  const terminal = active.length > 0 && active.every(isTerminalRelay);
  return (
    !followListFound &&
    !fallbackStarted &&
    (terminal || active.some((item) => item.eoseBySub[followSubId]))
  );
}

function isTerminalRelay(item: RelaySnapshot): boolean {
  return item.state === 'error' || item.state === 'closed';
}

export function emptyState(): TimelineState {
  return {
    items: [],
    loading: true,
    error: null,
    status: 'loading-follows',
    connectedRelays: 0,
    eoseRelays: 0,
    authors: [],
    profiles: {},
    diagnostics: [],
  };
}

export function noActiveAccountState(
  state: TimelineState,
  items: readonly TimelineItem[],
): TimelineState {
  return {
    ...state,
    items,
    loading: false,
    status: 'no-active-account',
    error: 'Add or activate an account to load an account home timeline.',
  };
}

export function noEnabledRelayState(state: TimelineState): TimelineState {
  return {
    ...state,
    loading: false,
    status: 'no-enabled-relay',
    error: errorFor('no-enabled-relay'),
  };
}

export function readyWithEventsState(
  state: TimelineState,
  items: readonly TimelineItem[],
): TimelineState {
  return {
    ...state,
    items,
    loading: false,
    error: null,
    status: 'ready-with-events',
  };
}

export function noFollowListState(
  state: TimelineState,
  authors: readonly string[],
  profiles: TimelineProfiles,
): TimelineState {
  return { ...state, authors, profiles, status: 'no-follow-list' };
}
