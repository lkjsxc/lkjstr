import type { NostrEvent } from '../protocol';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { selectLatestFollowList as selectLatestFollowListInFile } from './follow-list-sync-pure';
import { buildPreferredRelayGroups } from './follow-list-sync-groups';
import { readLatestFollowListFromRelaysWithGroup } from './follow-list-sync-read';

export type FollowListReadResult =
  | {
      readonly type: 'found';
      readonly followList: NostrEvent;
      readonly attemptedRelays: readonly string[];
      readonly relayUrls: readonly string[];
    }
  | { readonly type: 'notFound'; readonly attemptedRelays: readonly string[] }
  | {
      readonly type: 'partialFailure';
      readonly attemptedRelays: readonly string[];
    }
  | { readonly type: 'allFailed'; readonly attemptedRelays: readonly string[] }
  | { readonly type: 'aborted' };

export { selectLatestFollowListInFile as selectLatestFollowList };

type ReadLatestFollowListFromRelaysInput = {
  readonly activePubkey: string;
  readonly selectedRelays: readonly string[];
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly key: string;
};

function dedupePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export async function readLatestFollowListFromRelays(
  input: ReadLatestFollowListFromRelaysInput,
): Promise<FollowListReadResult> {
  if (!input.activePubkey) return { type: 'allFailed', attemptedRelays: [] };

  if (input.signal.aborted) return { type: 'aborted' };

  const groups = await buildPreferredRelayGroups({
    activePubkey: input.activePubkey,
    selectedRelays: input.selectedRelays,
  });

  const groupRelays = [
    groups.selected,
    groups.nip65,
    groups.receiptKind3,
    groups.provenance,
    groups.discovery,
  ];

  const attemptedRelays: string[] = [];
  const allEvents: NostrEvent[] = [];
  const followListRelaysById = new Map<string, Set<string>>();
  let anyEose = false;
  let anyFailure = false;

  for (let i = 0; i < groupRelays.length; i += 1) {
    const relays = groupRelays[i];
    if (relays.length === 0) continue;
    attemptedRelays.push(...relays);
    const result = await readLatestFollowListFromRelaysWithGroup({
      activePubkey: input.activePubkey,
      subscriptions: input.subscriptions,
      signal: input.signal,
      key: input.key,
      relays,
      groupIndex: i,
    });

    if (result.statuses.some((s) => s.aborted)) return { type: 'aborted' };
    anyEose ||= result.statuses.some((s) => s.eose);
    anyFailure ||= result.statuses.some(
      (s) =>
        !s.eose &&
        (s.timeout || s.socketError || s.auth || s.socketClosed || s.closed),
    );

    for (const { event, relay } of result.events) {
      allEvents.push(event);
      const set = followListRelaysById.get(event.id) ?? new Set<string>();
      set.add(relay);
      followListRelaysById.set(event.id, set);
    }

    const candidate = selectLatestFollowListInFile(
      input.activePubkey,
      allEvents,
    );
    if (candidate) {
      const relaysForCandidate =
        followListRelaysById.get(candidate.id) ??
        new Set<string>(attemptedRelays);
      return {
        type: 'found',
        followList: candidate,
        attemptedRelays: dedupePreserveOrder(attemptedRelays),
        relayUrls: dedupePreserveOrder([...relaysForCandidate]),
      };
    }
    if (input.signal.aborted) return { type: 'aborted' };
  }

  if (anyEose) {
    if (anyFailure) {
      return {
        type: 'partialFailure',
        attemptedRelays: dedupePreserveOrder(attemptedRelays),
      };
    }
    return {
      type: 'notFound',
      attemptedRelays: dedupePreserveOrder(attemptedRelays),
    };
  }

  return {
    type: 'allFailed',
    attemptedRelays: dedupePreserveOrder(attemptedRelays),
  };
}
