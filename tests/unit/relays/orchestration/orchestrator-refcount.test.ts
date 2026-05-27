import { describe, expect, it } from 'vitest';
import { createSubscriptionOrchestrator } from '../../../../src/lib/relays/orchestration/orchestrator';
import { createRelaySubscriptionManager } from '../../../../src/lib/relays/subscription-manager';
import { liveFeedDemand } from '../../../../src/lib/relays/orchestration/runtime-demand';

describe('subscription orchestrator', () => {
  it('shares one live subscription for compatible demands', () => {
    const manager = createRelaySubscriptionManager();
    const orchestrator = createSubscriptionOrchestrator(undefined as never, manager);
    const filters = [{ kinds: [1], limit: 30 }];
    const relays = ['wss://relay.example'];
    const releaseA = orchestrator.subscribeDemand(
      liveFeedDemand({
        surface: 'home',
        owner: 'tab-a',
        relays,
        filters,
      }),
      () => undefined,
    );
    const releaseB = orchestrator.subscribeDemand(
      liveFeedDemand({
        surface: 'home',
        owner: 'tab-b',
        relays,
        filters,
      }),
      () => undefined,
    );
    expect(manager.counts().liveSubscriptions).toBe(1);
    releaseA();
    expect(manager.counts().liveSubscriptions).toBe(1);
    releaseB();
    expect(manager.counts().liveSubscriptions).toBe(0);
  });
});
