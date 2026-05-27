import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { ReadPageRelayStatus } from '../relays/read-page-status';
import type { NostrEvent } from '../protocol';

export type ReadLatestFollowListFromRelaysWithGroupResult = {
  readonly events: readonly {
    readonly event: NostrEvent;
    readonly relay: string;
  }[];
  readonly attemptedRelays: readonly string[];
  readonly statuses: readonly ReadPageRelayStatus[];
};

export async function readLatestFollowListFromRelaysWithGroup(input: {
  readonly activePubkey: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly key: string;
  readonly relays: readonly string[];
  readonly groupIndex: number;
}): Promise<ReadLatestFollowListFromRelaysWithGroupResult> {
  const { events, statuses } = await input.subscriptions.readPageDetailed(
    {
      key: `${input.key}:follow-sync:${input.groupIndex}`,
      relays: input.relays,
      purpose: 'metadata',
      filters: [{ kinds: [3], authors: [input.activePubkey], limit: 1 }],
    },
    { signal: input.signal },
  );

  return {
    events,
    attemptedRelays: input.relays,
    statuses,
  };
}
