import type { NostrEvent } from '$lib/protocol';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { buildPreferredRelayGroups } from '$lib/timeline/follow-list-sync-groups';
import { selectLatestFollowList } from '$lib/timeline/follow-list-sync';
import { readLatestFollowListFromRelaysWithGroup } from '$lib/timeline/follow-list-sync-read';
import {
  dedupe,
  failedRelaysFromStatuses,
  hasRelayEose,
  hasRelayFailure,
} from './target-follow-list-diagnostics';
import type { TargetFollowListSource } from './target-follow-list-state';

export type TargetFollowListReadPhase = Exclude<
  TargetFollowListSource,
  'none' | 'cache'
>;

type ReadDiagnostics = {
  readonly attemptedRouteGroups?: readonly string[];
  readonly failedRouteGroups?: readonly string[];
  readonly reasonCodes?: readonly string[];
};

export type TargetFollowListReadResult =
  | ({
      readonly type: 'found';
      readonly followList: NostrEvent;
      readonly source: TargetFollowListReadPhase;
      readonly attemptedRelays: readonly string[];
      readonly failedRelays: readonly string[];
      readonly relayUrls: readonly string[];
    } & ReadDiagnostics)
  | ({
      readonly type: 'notFound' | 'partialFailure' | 'allFailed';
      readonly attemptedRelays: readonly string[];
      readonly failedRelays: readonly string[];
    } & ReadDiagnostics)
  | { readonly type: 'aborted' };

export async function readTargetFollowList(input: {
  readonly targetPubkey: string;
  readonly selectedRelays: readonly string[];
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly key: string;
  readonly allowDiscoveryFallback?: boolean;
  readonly onPhase?: (phase: TargetFollowListReadPhase) => void;
}): Promise<TargetFollowListReadResult> {
  if (input.signal.aborted) return { type: 'aborted' };
  const groups = await buildPreferredRelayGroups({
    activePubkey: input.targetPubkey,
    selectedRelays: input.selectedRelays,
    allowDiscoveryFallback: input.allowDiscoveryFallback,
  });
  const plan: [TargetFollowListReadPhase, readonly string[]][] = [
    ['selected', groups.selected],
    ['author_routes', groups.nip65],
    ['receipt_routes', groups.receiptKind3],
    ['provenance_routes', groups.provenance],
    ['discovery', groups.discovery],
  ];
  return readPlannedGroups({ ...input, plan });
}

async function readPlannedGroups(input: {
  readonly targetPubkey: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly key: string;
  readonly plan: readonly [TargetFollowListReadPhase, readonly string[]][];
  readonly onPhase?: (phase: TargetFollowListReadPhase) => void;
}): Promise<TargetFollowListReadResult> {
  const attempted: string[] = [];
  const failed: string[] = [];
  const attemptedGroups: string[] = [];
  const failedGroups: string[] = [];
  const allEvents: NostrEvent[] = [];
  const relaysByEvent = new Map<string, Set<string>>();
  let anyEose = false;
  let anyFailure = false;
  for (const [source, relays] of input.plan) {
    if (relays.length === 0) continue;
    input.onPhase?.(source);
    attemptedGroups.push(source);
    attempted.push(...relays);
    const groupIndex = input.plan.findIndex((item) => item[0] === source);
    const result = await readLatestFollowListFromRelaysWithGroup({
      activePubkey: input.targetPubkey,
      subscriptions: input.subscriptions,
      signal: input.signal,
      key: input.key,
      relays,
      groupIndex,
    });
    if (result.statuses.some((status) => status.aborted))
      return { type: 'aborted' };
    const groupFailed = failedRelaysFromStatuses(result.statuses);
    if (groupFailed.length > 0) failedGroups.push(source);
    anyEose ||= hasRelayEose(result.statuses);
    anyFailure ||= hasRelayFailure(result.statuses);
    failed.push(...groupFailed);
    for (const item of result.events)
      addEventRelay(allEvents, relaysByEvent, item);
    const candidate = selectLatestFollowList(input.targetPubkey, allEvents);
    if (candidate)
      return found(candidate, source, attempted, failed, relaysByEvent, {
        attemptedGroups,
        failedGroups,
      });
    if (input.signal.aborted) return { type: 'aborted' };
  }
  const diagnostics = readDiagnostics(attemptedGroups, failedGroups);
  if (anyEose)
    return anyFailure
      ? {
          type: 'partialFailure',
          attemptedRelays: dedupe(attempted),
          failedRelays: dedupe(failed),
          ...diagnostics,
        }
      : {
          type: 'notFound',
          attemptedRelays: dedupe(attempted),
          failedRelays: [],
          ...diagnostics,
        };
  return {
    type: 'allFailed',
    attemptedRelays: dedupe(attempted),
    failedRelays: dedupe(failed),
    ...diagnostics,
  };
}

function readDiagnostics(
  attemptedGroups: readonly string[],
  failedGroups: readonly string[],
): ReadDiagnostics {
  return {
    attemptedRouteGroups: dedupe(attemptedGroups),
    failedRouteGroups: dedupe(failedGroups),
    reasonCodes: attemptedGroups.length === 0 ? ['no-route-groups'] : [],
  };
}

function addEventRelay(
  events: NostrEvent[],
  relaysByEvent: Map<string, Set<string>>,
  item: { readonly event: NostrEvent; readonly relay: string },
): void {
  events.push(item.event);
  const relays = relaysByEvent.get(item.event.id) ?? new Set<string>();
  relays.add(item.relay);
  relaysByEvent.set(item.event.id, relays);
}

function found(
  event: NostrEvent,
  source: TargetFollowListReadPhase,
  attempted: readonly string[],
  failed: readonly string[],
  relaysByEvent: Map<string, Set<string>>,
  diagnostics: {
    attemptedGroups: readonly string[];
    failedGroups: readonly string[];
  },
): TargetFollowListReadResult {
  return {
    type: 'found',
    followList: event,
    source,
    attemptedRelays: dedupe(attempted),
    failedRelays: dedupe(failed),
    relayUrls: dedupe([...(relaysByEvent.get(event.id) ?? [])]),
    ...readDiagnostics(diagnostics.attemptedGroups, diagnostics.failedGroups),
  };
}
