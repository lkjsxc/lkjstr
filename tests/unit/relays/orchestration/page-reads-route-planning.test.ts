import { describe, expect, it } from 'vitest';
import {
  pageIntentSemanticKey,
  plannedPageIntent,
  resolvePagingRoutePurpose,
  routeGroupFingerprint,
} from '../../../../src/lib/relays/orchestration/page-reads';

describe('page route planning keys', () => {
  it('dedupes relay and author order for compatible pages', () => {
    const base = {
      surface: 'home' as const,
      owner: 'tab',
      phase: 'page' as const,
      selectedRelays: ['wss://b', 'wss://a'],
      authors: [pubkey('b'), pubkey('a')],
      pageSize: 30,
      direction: 'older' as const,
      cursor,
      purpose: 'feed' as const,
    };

    expect(pageIntentSemanticKey(base)).toBe(
      pageIntentSemanticKey({
        ...base,
        selectedRelays: ['wss://a', 'wss://b'],
        authors: [pubkey('a'), pubkey('b')],
      }),
    );
  });

  it('separates purpose and cursor bounds in page keys', () => {
    const base = {
      surface: 'custom-request' as const,
      owner: 'tool',
      phase: 'page' as const,
      selectedRelays: ['wss://relay'],
      authors: [],
      pageSize: 30,
      direction: 'older' as const,
      cursor,
    };

    expect(pageIntentSemanticKey({ ...base, purpose: 'feed' })).not.toBe(
      pageIntentSemanticKey({ ...base, purpose: 'search' }),
    );
    expect(pageIntentSemanticKey({ ...base, purpose: 'feed' })).not.toBe(
      pageIntentSemanticKey({
        ...base,
        purpose: 'feed',
        cursor: { createdAt: 1_699_999_999, id: pubkey('c') },
      }),
    );
  });

  it('separates selected-tool filter shapes in page keys', () => {
    const base = {
      surface: 'search' as const,
      owner: 'tool',
      phase: 'bootstrap' as const,
      selectedRelays: ['wss://relay'],
      authors: [],
      pageSize: 30,
      direction: 'initial' as const,
      purpose: 'search' as const,
    };

    expect(
      pageIntentSemanticKey({
        ...base,
        relayFilters: [{ kinds: [1], search: 'alpha', limit: 30 }],
      }),
    ).not.toBe(
      pageIntentSemanticKey({
        ...base,
        relayFilters: [{ kinds: [1], search: 'beta', limit: 30 }],
      }),
    );
  });

  it('keeps route fingerprints stable across group, relay, and author order', () => {
    const left = routeGroupFingerprint([
      fallbackGroup(['wss://b/', 'wss://a/'], [pubkey('b'), pubkey('a')]),
      authorGroup(['wss://route-b/', 'wss://route-a/']),
    ]);
    const right = routeGroupFingerprint([
      authorGroup(['wss://route-a/', 'wss://route-b/']),
      fallbackGroup(['wss://a/', 'wss://b/'], [pubkey('a'), pubkey('b')]),
    ]);

    expect(left).toBe(right);
  });

  it('plans route fingerprints without changing owner compatibility', () => {
    const base = {
      surface: 'profile' as const,
      owner: 'tab-a',
      phase: 'page' as const,
      selectedRelays: ['wss://selected'],
      authors: [pubkey('a')],
      pageSize: 30,
      direction: 'older' as const,
      cursor,
      purpose: 'feed' as const,
    };
    const groups = [authorGroup(['wss://route/'])];
    const planned = plannedPageIntent(base, groups);

    expect(planned.routeFingerprint).toBe(routeGroupFingerprint(groups));
    expect(pageIntentSemanticKey(planned)).toBe(
      pageIntentSemanticKey({ ...planned, owner: 'tab-b' }),
    );
  });

  it('uses author write routes only for authored timeline paging', () => {
    expect(resolvePagingRoutePurpose({ surface: 'home' })).toBe('write');
    expect(resolvePagingRoutePurpose({ surface: 'profile' })).toBe('write');
    expect(resolvePagingRoutePurpose({ surface: 'global' })).toBe('both');
    expect(resolvePagingRoutePurpose({ surface: 'notifications' })).toBe(
      'both',
    );
  });
});

const cursor = { createdAt: 1_700_000_000, id: pubkey('0') };

function pubkey(value: string): string {
  return value.repeat(64);
}

function authorGroup(relays: readonly string[]) {
  const author = pubkey('a');
  return {
    key: `author:${author}`,
    relays,
    authors: [author],
    source: 'nip65' as const,
  };
}

function fallbackGroup(relays: readonly string[], authors: readonly string[]) {
  return { key: 'fallback:0', relays, authors, source: 'fallback' as const };
}
