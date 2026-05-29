import { beforeEach, describe, expect, it } from 'vitest';
import { upsertEvent } from '../../../src/lib/events/repository';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrFilter } from '../../../src/lib/protocol';
import {
  cover,
  event,
  otherRelay,
  pageFor,
  poolEvent,
  relay,
  resetCacheScanTests,
  span,
  subscriptions,
  throwingSubscriptions,
} from './relay-page-scan-cache-helpers';

describe('relay page scan cache coverage', () => {
  beforeEach(() => resetCacheScanTests());

  it('skips a covered empty segment and advances to the grown remote window', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-empty', relay, 'complete');

    await pageFor('cache-empty', { calls, pageSize: 2, limit: 10 });

    expect(calls[0]).toEqual(expect.objectContaining({ since: 9_822 }));
    expect(span(calls[0]!)).toBe(120);
  });

  it('returns covered cached rows without waiting for relays', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-hit', relay, 'complete');
    await upsertEvent(event('a', 9_999), [relay]);

    const page = await pageFor('cache-hit', { calls, pageSize: 1, limit: 10 });

    expect(page.items.map((item) => item.event.id)).toEqual(['a'.repeat(64)]);
    expect(calls).toEqual([]);
  });

  it('does not call relay manager when all relay coverage is cached', async () => {
    await cover('cache-no-call', relay, 'complete');
    await upsertEvent(event('a', 9_999), [relay]);

    const page = await pageFor('cache-no-call', {
      calls: [],
      pageSize: 1,
      limit: 10,
      subscriptions: throwingSubscriptions(),
    });

    expect(page.items.map((item) => item.event.id)).toEqual(['a'.repeat(64)]);
    expect(page.incomplete).toBe(false);
    expect(page.dense).toBe(false);
  });

  it('prunes covered relays and reads only uncovered relays', async () => {
    const requests: RelayReadRequest[] = [];
    await cover('cache-partial', relay, 'complete');
    await upsertEvent(event('a', 9_999), [relay]);

    const page = await pageFor('cache-partial', {
      calls: [],
      pageSize: 2,
      limit: 10,
      relays: [relay, otherRelay],
      subscriptions: subscriptions([], requests, [poolEvent('b', otherRelay)]),
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.relays).toEqual([otherRelay]);
    expect(page.items.map((item) => item.event.id)).toEqual([
      'a'.repeat(64),
      'b'.repeat(64),
    ]);
  });

  it('does not skip relays for dense or missing coverage', async () => {
    const denseCalls: NostrFilter[] = [];
    await cover('cache-dense', relay, 'dense');
    await pageFor('cache-dense', { calls: denseCalls, pageSize: 1, limit: 10 });
    expect(span(denseCalls[0]!)).toBe(60);

    const missingCalls: NostrFilter[] = [];
    await pageFor('cache-missing', {
      calls: missingCalls,
      pageSize: 1,
      limit: 10,
    });
    expect(span(missingCalls[0]!)).toBe(60);
  });
});
