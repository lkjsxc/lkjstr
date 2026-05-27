import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { createRelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import { managerAsOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import {
  createTimelineRuntime,
  type TimelineRuntime,
} from '../../../src/lib/timeline/timeline-runtime';

export function runtimeFor(options: {
  activeAccountPubkey?: string | null;
  relays?: readonly string[];
}): TimelineRuntime {
  const pool = createRelayPool();
  return createTimelineRuntime({
    relays: options.relays ?? ['relay.example'],
    subId: 'timeline-test',
    owner: 'timeline-test',
    activeAccountPubkey: options.activeAccountPubkey,
    pool,
    subscriptions: managerAsOrchestrator(createRelaySubscriptionManager(pool), {
      keyPrefix: 'timeline-test',
    }),
  });
}
