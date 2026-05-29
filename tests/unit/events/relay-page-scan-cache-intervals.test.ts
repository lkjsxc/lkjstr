import { beforeEach, describe, expect, it } from 'vitest';
import { upsertEvent } from '../../../src/lib/events/repository';
import type { NostrFilter } from '../../../src/lib/protocol';
import {
  cover,
  event,
  pageFor,
  relay,
  resetCacheScanTests,
  span,
} from './relay-page-scan-cache-helpers';

describe('relay page scan cache interval proof', () => {
  beforeEach(() => resetCacheScanTests());

  it('uses adjacent complete coverage rows to skip relays', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-adjacent', relay, 'complete', {
      since: 9_941,
      until: 9_971,
    });
    await cover('cache-adjacent', relay, 'complete', {
      since: 9_971,
      until: 10_001,
    });
    await upsertEvent(event('a', 9_999), [relay]);

    await pageFor('cache-adjacent', { calls, pageSize: 1, limit: 10 });

    expect(calls).toEqual([]);
  });

  it('uses overlapping complete coverage rows to skip relays', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-overlap', relay, 'complete', {
      since: 9_900,
      until: 9_980,
    });
    await cover('cache-overlap', relay, 'complete', {
      since: 9_970,
      until: 10_001,
    });
    await upsertEvent(event('a', 9_999), [relay]);

    await pageFor('cache-overlap', { calls, pageSize: 1, limit: 10 });

    expect(calls).toEqual([]);
  });

  it('queries relays when complete coverage has a one-second gap', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-gap', relay, 'complete', { since: 9_941, until: 9_970 });
    await cover('cache-gap', relay, 'complete', {
      since: 9_971,
      until: 10_001,
    });

    await pageFor('cache-gap', { calls, pageSize: 1, limit: 10 });

    expect(span(calls[0]!)).toBe(60);
  });

  it('queries relays when dense coverage fills the gap', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-dense-gap', relay, 'complete', {
      since: 9_941,
      until: 9_970,
    });
    await cover('cache-dense-gap', relay, 'dense', {
      since: 9_970,
      until: 10_001,
    });

    await pageFor('cache-dense-gap', { calls, pageSize: 1, limit: 10 });

    expect(span(calls[0]!)).toBe(60);
  });

  it('does not skip relays for the wrong route group or semantic filter', async () => {
    const wrongGroupCalls: NostrFilter[] = [];
    await cover('cache-wrong-group', relay, 'complete', undefined, {
      groupKey: 'other-group',
    });
    await pageFor('cache-wrong-group', {
      calls: wrongGroupCalls,
      pageSize: 1,
      limit: 10,
    });
    expect(span(wrongGroupCalls[0]!)).toBe(60);

    const wrongFilterCalls: NostrFilter[] = [];
    await cover('cache-wrong-filter', relay, 'complete', undefined, {
      kinds: [6],
    });
    await pageFor('cache-wrong-filter', {
      calls: wrongFilterCalls,
      pageSize: 1,
      limit: 10,
    });
    expect(span(wrongFilterCalls[0]!)).toBe(60);
  });

  it('filters cached rows outside display and same-second cursor bounds', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-bounds', relay, 'complete');
    await upsertEvent(event('a', 9_999), [relay]);
    await upsertEvent(event('b', 9_000), [relay]);
    await upsertEvent(event('e', 10_000), [relay]);
    await upsertEvent(event('f', 10_000), [relay]);

    const page = await pageFor('cache-bounds', {
      calls,
      pageSize: 1,
      limit: 10,
    });

    expect(page.items.map((item) => item.event.id)).toEqual(['a'.repeat(64)]);
    expect(calls).toEqual([]);
  });
});
