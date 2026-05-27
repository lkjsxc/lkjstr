import { compareEventsDesc, type NostrEvent } from '../protocol';
import { feedWindowSize } from '../events/feed-window';
import type { FeedCursorPoint } from '../events/types';
import type { FeedTabSnapshotSeed } from '../workspace/tab-snapshot';
import type { RelayPool } from '../relays/relay-pool';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
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
  readonly loadingOlder: boolean;
  readonly loadingNewer: boolean;
  readonly hasOlder: boolean;
  readonly hasNewer: boolean;
  readonly oldestCursor?: FeedCursorPoint;
  readonly newestCursor?: FeedCursorPoint;
};

export type TimelineRuntimeOptions = {
  readonly seed?: FeedTabSnapshotSeed;
  readonly relays: readonly string[];
  readonly subId: string;
  readonly owner?: string;
  readonly kind?: 'home' | 'global';
  readonly activeAccountPubkey?: string | null;
  readonly limit?: number;
  readonly pool?: RelayPool;
  readonly subscriptions?: SubscriptionOrchestrator;
};

export function upsertLive(
  items: readonly TimelineItem[],
  event: NostrEvent,
  relay: string,
  limit = feedWindowSize,
): TimelineItem[] {
  const existing = items.find((item) => item.event.id === event.id);
  const next = existing
    ? items.map((item) =>
        item.event.id === event.id
          ? { event, relays: [...new Set([...item.relays, relay])] }
          : item,
      )
    : [...items, { event, relays: [relay] }];
  return next
    .sort((left, right) => compareEventsDesc(left.event, right.event))
    .slice(0, limit);
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

function subscriptionEose(
  item: RelaySnapshot,
  subId: string,
): boolean {
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

export function missingFollowAfterEose(
  active: readonly RelaySnapshot[],
  followListFound: boolean,
  fallbackStarted: boolean,
  followSubId: string,
): boolean {
  const terminal = active.length > 0 && active.every(isTerminalRelay);
  const complete =
    active.length > 0 &&
    active.every(
      (item) =>
        subscriptionEose(item, followSubId) ||
        item.closedBySub[followSubId] ||
        isTerminalRelay(item),
    );
  return !followListFound && !fallbackStarted && (terminal || complete);
}

function isTerminalRelay(item: RelaySnapshot): boolean {
  return item.state === 'error' || item.state === 'closed';
}

function isTerminalSubscription(item: RelaySnapshot, subId: string): boolean {
  return isTerminalRelay(item) || Boolean(item.closedBySub[subId]);
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
    loadingOlder: false,
    loadingNewer: false,
    hasOlder: true,
    hasNewer: false,
    oldestCursor: undefined,
    newestCursor: undefined,
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
