import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import {
  clearRelayRoutesForTests,
  saveAuthorRelayRoute,
} from '../../../src/lib/relays/relay-route-store';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import { createTimelineRuntime } from '../../../src/lib/timeline/timeline-runtime';
import { storeTimelineEvent } from '../../../src/lib/timeline/timeline-store';

describe('timeline route discovery startup', () => {
  beforeEach(() => clearRelayRoutesForTests());
  afterEach(() => clearRelayRoutesForTests());

  it('defers route discovery until after the initial selected-relay page', async () => {
    const activeKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = getPublicKey(generateSecretKey());
    const initialPage = deferred<PoolEvent[]>();
    const calls: Call[] = [];
    const subscriptions = subscriptionsFor(calls, initialPage);
    await storeTimelineEvent(
      finalizeEvent(
        { created_at: 130, kind: 3, tags: [['p', followed]], content: '' },
        activeKey,
      ),
    );
    await saveAuthorRelayRoute({
      authorPubkey: followed,
      relayUrl: 'route.example',
      source: 'nip65',
      purpose: 'write',
      eventId: '1'.repeat(64),
    });

    const runtime = createTimelineRuntime({
      relays: ['selected.example'],
      subId: 'timeline-test',
      activeAccountPubkey: active,
      subscriptions,
    });
    await runtime.start();

    expect(calls.some(initialNotesRead)).toBe(true);
    expect(
      calls.some((call) => call.key === 'timeline-test:notes:routes'),
    ).toBe(false);
    const liveNotes = calls.find((call) => call.key === 'timeline-test:notes');
    expect(liveNotes?.relays).toEqual([
      'wss://route.example/',
      'wss://selected.example/',
    ]);

    initialPage.resolve([]);
    await vi.waitFor(() =>
      expect(calls.map((call) => call.key)).toContain(
        'timeline-test:notes:routes',
      ),
    );
    const routeIndex = calls.findIndex(
      (call) => call.key === 'timeline-test:notes:routes',
    );
    const liveIndex = calls.findIndex(
      (call) => call.key === 'timeline-test:notes',
    );
    expect(routeIndex).toBeGreaterThan(liveIndex);
  });
});

type Call = {
  readonly type: 'read' | 'live';
  readonly key: string;
  readonly relays: readonly string[];
};

function subscriptionsFor(
  calls: Call[],
  initialPage: ReturnType<typeof deferred<PoolEvent[]>>,
): RelaySubscriptionManager {
  return {
    readPage: async (request: RelayReadRequest) => {
      calls.push({ type: 'read', key: request.key, relays: request.relays });
      if (request.key.includes(':notes:initial')) return initialPage.promise;
      return [];
    },
    subscribeLive: (request: RelayReadRequest) => {
      calls.push({ type: 'live', key: request.key, relays: request.relays });
      return () => undefined;
    },
    subscribeState: () => () => undefined,
  } as unknown as RelaySubscriptionManager;
}

function initialNotesRead(call: Call): boolean {
  return (
    call.type === 'read' && call.key.startsWith('timeline-test:notes:initial')
  );
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
