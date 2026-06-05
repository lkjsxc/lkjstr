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

export type TargetFollowListReadResult =
  | {
      readonly type: 'found';
      readonly followList: NostrEvent;
      readonly source: TargetFollowListReadPhase;
      readonly attemptedRelays: readonly string[];
      readonly failedRelays: readonly string[];
      readonly relayUrls: readonly string[];
    }
  | {
      readonly type: 'notFound' | 'partialFailure' | 'allFailed';
      readonly attemptedRelays: readonly string[];
      readonly failedRelays: readonly string[];
    }
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
  const allEvents: NostrEvent[] = [];
  const relaysByEvent = new Map<string, Set<string>>();
  let anyEose = false;
  let anyFailure = false;
  for (const [source, relays] of input.plan) {
    if (relays.length === 0) continue;
    input.onPhase?.(source);
    attempted.push(...relays);
    const result = await readLatestFollowListFromRelaysWithGroup({
      activePubkey: input.targetPubkey,
      subscriptions: input.subscriptions,
      signal: input.signal,
      key: input.key,
      relays,
      groupIndex: input.plan.findIndex((item) => item[0] === source),
    });
    if (result.statuses.some((status) => status.aborted))
      return { type: 'aborted' };
    anyEose ||= hasRelayEose(result.statuses);
    anyFailure ||= hasRelayFailure(result.statuses);
    failed.push(...failedRelaysFromStatuses(result.statuses));
    for (const item of result.events)
      addEventRelay(allEvents, relaysByEvent, item);
    const candidate = selectLatestFollowList(input.targetPubkey, allEvents);
    if (candidate)
      return found(candidate, source, attempted, failed, relaysByEvent);
    if (input.signal.aborted) return { type: 'aborted' };
  }
  if (anyEose)
    return anyFailure
      ? {
          type: 'partialFailure',
          attemptedRelays: dedupe(attempted),
          failedRelays: dedupe(failed),
        }
      : {
          type: 'notFound',
          attemptedRelays: dedupe(attempted),
          failedRelays: [],
        };
  return {
    type: 'allFailed',
    attemptedRelays: dedupe(attempted),
    failedRelays: dedupe(failed),
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
): TargetFollowListReadResult {
  return {
    type: 'found',
    followList: event,
    source,
    attemptedRelays: dedupe(attempted),
    failedRelays: dedupe(failed),
    relayUrls: dedupe([...(relaysByEvent.get(event.id) ?? [])]),
  };
}
