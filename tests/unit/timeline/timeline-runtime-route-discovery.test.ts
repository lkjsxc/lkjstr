import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../../src/lib/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import {
  clearRelayRoutesForTests,
  saveAuthorRelayRoute,
} from '../../../src/lib/relays/relay-route-store';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import type { Demand } from '../../../src/lib/relays/orchestration/demand-types';
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
    const liveNotes = calls.find((call) => call.type === 'live');
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
    const liveIndex = calls.findIndex((call) => call.type === 'live');
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
): SubscriptionOrchestrator {
  const base = {
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
    readPageDetailed: async (request: RelayReadRequest) => ({
      events: await base.readPage(request),
      statuses: [],
    }),
    close: () => undefined,
    counts: () => ({
      liveSubscriptions: 0,
      liveListeners: 0,
      inFlightReads: 0,
    }),
  };
  return {
    ...base,
    subscribeDemand: (demand: Demand) => {
      calls.push({
        type: 'live',
        key: demand.owner,
        relays: demand.relays,
      });
      return () => undefined;
    },
    readDemandPage: async (demand: Demand) =>
      base.readPageDetailed({
        key: demand.owner,
        relays: demand.relays,
        filters: demand.filters,
        purpose: demand.purpose,
      }),
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
