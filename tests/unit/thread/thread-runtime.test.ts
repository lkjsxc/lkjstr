import { beforeEach, describe, expect, it } from 'vitest';
import { createThreadRuntime } from '../../../src/lib/thread/thread-runtime';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import { storeThreadEvent } from '../../../src/lib/thread/thread-store';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';

describe('thread runtime', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('reports no enabled read relays without opening sockets', async () => {
    const states: string[] = [];
    const runtime = createThreadRuntime(
      'a'.repeat(64),
      [],
      'thread-test',
      'thread-test',
      createRelayPool(),
    );
    runtime.subscribe((state) =>
      states.push(`${state.loading}:${state.error ?? ''}`),
    );
    await runtime.start();
    expect(states.at(-1)).toBe('false:No enabled read relays.');
  });

  it('clears loadingOlder when an older page fails', async () => {
    const root = 'a'.repeat(64);
    await storeThreadEvent(event(root, 10));
    const states: string[] = [];
    const runtime = createThreadRuntime(
      root,
      ['wss://relay.example/'],
      'thread-test',
      'thread-test',
      createRelayPool(),
      failingSubscriptions(),
    );
    runtime.subscribe((state) =>
      states.push(`${state.loadingOlder}:${state.error ?? ''}`),
    );
    await runtime.start();
    await runtime.loadOlder();
    expect(states.at(-1)).toBe('false:older failed');
  });
});

function failingSubscriptions(): SubscriptionOrchestrator {
  const base = {
    subscribeState: () => () => undefined,
    subscribeLive: () => () => undefined,
    readPage: async () => {
      throw new Error('older failed');
    },
    readPageDetailed: async () => {
      throw new Error('older failed');
    },
    close: () => undefined,
    counts: () => ({
      liveSubscriptions: 0,
      liveListeners: 0,
      inFlightReads: 0,
    }),
  };
  return {
    ...base,
    subscribeDemand: () => () => undefined,
    readDemandPage: async () => {
      throw new Error('older failed');
    },
    pauseOwner: () => undefined,
    resumeOwner: () => undefined,
    releaseOwner: () => undefined,
    metricsSnapshot: () => ({
      activeDemands: 0,
      activeLeases: 0,
      liveLeases: 0,
      bootstrapLeases: 0,
      relayReqTotal: 0,
      relayCloseTotal: 0,
      eventsReceived: 0,
      eventsAccepted: 0,
      eventsDroppedDuplicate: 0,
      eventsDroppedNonRenderCritical: 0,
    }),
  };
}

function event(id: string, created_at: number) {
  return {
    id,
    pubkey: 'b'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: 'root',
    sig: 'c'.repeat(128),
  };
}
