import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { NostrEvent } from '../../../src/lib/protocol';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('relay feed group pages', () => {
  it('reads relay groups sequentially', async () => {
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

    await Promise.resolve();
    expect(calls).toEqual(['relay-page-sequential:0:0:first:0:0']);
    first.resolve([]);
    await page;
    expect(calls.slice(0, 2)).toEqual([
      'relay-page-sequential:0:0:first:0:0',
      'relay-page-sequential:0:1:second:0:0',
    ]);
    expect(
      calls.indexOf('relay-page-sequential:0:1:second:0:0'),
    ).toBeGreaterThan(calls.indexOf('relay-page-sequential:0:0:first:0:0'));
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
