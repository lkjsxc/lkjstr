import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { NostrEvent } from '../../../src/lib/protocol';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import type { ReadPageOptions } from '../../../src/lib/relays/subscription-manager-types';

describe('relay feed group pages', () => {
  it('reads relay groups with bounded concurrency', async () => {
    const first = deferred<PoolEvent[]>();
    const calls: string[] = [];
    const page = readRelayFeedGroups({
      key: 'relay-page-sequential',
      groups: [
        group('first', 'wss://relay-a/', 'a'.repeat(64)),
        group('second', 'wss://relay-b/', 'b'.repeat(64)),
      ],
      filters: () => [{ kinds: [1] }],
      pageSize: 10,
      subscriptions: {
        readPage: async (request: RelayReadRequest) => {
          calls.push(request.key);
          if (request.key.endsWith(':first:0:0')) return first.promise;
          return [];
        },
      } as unknown as RelaySubscriptionManager,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.slice(0, 2)).toEqual([
      'relay-page-sequential:0:0:first:0:0',
      'relay-page-sequential:0:1:second:0:0',
    ]);
    first.resolve([]);
    await page;
  });

  it('merges sequential relay group provenance and has-more state', async () => {
    const now = Math.floor(Date.now() / 1000);
    const page = await readRelayFeedGroups({
      key: 'relay-page-group-merge',
      groups: [
        group('first', 'wss://relay-a/', 'a'.repeat(64)),
        group('second', 'wss://relay-b/', 'a'.repeat(64)),
      ],
      filters: () => [{ kinds: [1] }],
      pageSize: 1,
      subscriptions: {
        readPage: async (request: RelayReadRequest) => [
          receipt(event('1', now), request.relays[0] ?? ''),
        ],
      } as unknown as RelaySubscriptionManager,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.relays).toEqual(['wss://relay-a/', 'wss://relay-b/']);
    expect(page.hasMorePossible).toBe(true);
  });

  it('keeps grouped progressive snapshots non-terminal until all groups finish', async () => {
    const slow = deferred<ReadPageResult>();
    const snapshots: { final: boolean; ids: string[] }[] = [];
    const now = Math.floor(Date.now() / 1000);
    const page = readRelayFeedGroups({
      key: 'relay-page-progress',
      groups: [
        group('fast', 'wss://fast/', 'a'.repeat(64)),
        group('slow', 'wss://slow/', 'b'.repeat(64)),
      ],
      filters: () => [{ kinds: [1] }],
      pageSize: 10,
      subscriptions: {
        readPageDetailed: async (
          request: RelayReadRequest,
          options?: ReadPageOptions,
        ) => {
          if (request.relays[0] === 'wss://slow/') return slow.promise;
          const events = [receipt(event('1', now), 'wss://fast/')];
          options?.onSnapshot?.({
            readId: request.key,
            status: 'complete',
            reason: 'finalize',
            events,
            relays: [],
            startedAt: 1,
            updatedAt: 1,
            durationMs: 1,
            final: true,
          });
          return detailed(request, events);
        },
      } as unknown as RelaySubscriptionManager,
      onSnapshot: (snapshot) =>
        snapshots.push({
          final: snapshot.final,
          ids: snapshot.events.map((item) => item.event.id),
        }),
    });

    await waitFor(() => snapshots.length > 0);
    expect(
      snapshots.some(
        (snapshot) => !snapshot.final && snapshot.ids.includes('1'.repeat(64)),
      ),
    ).toBe(true);
    slow.resolve(
      detailed({ key: 'slow', relays: ['wss://slow/'], filters: [] }, []),
    );
    await page;

    expect(snapshots.at(-1)?.final).toBe(true);
  });
});

function group(key: string, relay: string, author: string) {
  return {
    key,
    relays: [relay],
    authors: [author],
    source: 'fallback' as const,
  };
}

function receipt(event: NostrEvent, relay: string): PoolEvent {
  return { event, relay, subId: 'sub' };
}

function event(seed: string, created_at: number): NostrEvent {
  return {
    id: seed.repeat(64),
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: seed,
    sig: 'b'.repeat(128),
  };
}

function detailed(
  request: RelayReadRequest,
  events: readonly PoolEvent[],
): ReadPageResult {
  return {
    events: [...events],
    statuses: request.relays.map((relay) => ({
      relay,
      eose: true,
      timeout: false,
      closed: false,
      auth: false,
      socketClosed: false,
      socketError: false,
      durationMs: 1,
      candidateCount: events.length,
      finalCount: events.length,
    })),
  };
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

async function waitFor(done: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (done()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
