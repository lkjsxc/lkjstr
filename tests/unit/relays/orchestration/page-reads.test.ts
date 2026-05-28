import { describe, expect, it } from 'vitest';
import {
  pageIntentBounds,
  pageIntentSemanticKey,
  routeGroupFingerprint,
} from '../../../../src/lib/relays/orchestration/page-reads';

describe('pageIntentSemanticKey', () => {
  it('dedupes across owners with the same semantic page', () => {
    const base = {
      surface: 'home' as const,
      phase: 'page' as const,
      selectedRelays: ['wss://a', 'wss://b'],
      authors: ['c'.repeat(64)],
      pageSize: 30,
      direction: 'older' as const,
      cursor: { createdAt: 1_700_000_000, id: 'abc' },
      purpose: 'feed' as const,
    };
    const keyA = pageIntentSemanticKey({ ...base, owner: 'tab-a' });
    const keyB = pageIntentSemanticKey({ ...base, owner: 'tab-b' });
    expect(keyA).toBe(keyB);
  });

  it('changes when resolved route groups change', () => {
    const base = {
      surface: 'home' as const,
      phase: 'bootstrap' as const,
      selectedRelays: ['wss://selected'],
      authors: ['c'.repeat(64)],
      pageSize: 30,
      direction: 'initial' as const,
      purpose: 'feed' as const,
    };
    const selected = routeGroupFingerprint([
      {
        key: 'fallback:0',
        relays: ['wss://selected/'],
        authors: base.authors,
        source: 'fallback',
      },
    ]);
    const routed = routeGroupFingerprint([
      {
        key: `author:${base.authors[0]}`,
        relays: ['wss://route/'],
        authors: base.authors,
        source: 'nip65',
      },
    ]);
    expect(
      pageIntentSemanticKey({
        ...base,
        owner: 'a',
        routeFingerprint: selected,
      }),
    ).not.toBe(
      pageIntentSemanticKey({ ...base, owner: 'a', routeFingerprint: routed }),
    );
  });

  it('derives scan bounds from direction and cursor', () => {
    const cursor = { createdAt: 1_700_000_000, id: 'a'.repeat(64) };
    const base = {
      surface: 'profile' as const,
      owner: 'tab',
      phase: 'page' as const,
      selectedRelays: ['wss://relay'],
      authors: ['b'.repeat(64)],
      pageSize: 30,
      cursor,
      purpose: 'feed' as const,
    };

    expect(pageIntentBounds({ ...base, direction: 'older' })).toEqual({
      before: cursor,
      after: undefined,
    });
    expect(pageIntentBounds({ ...base, direction: 'newer' })).toEqual({
      before: undefined,
      after: cursor,
    });
  });

  it('keeps notification, profile, and home page keys isolated', () => {
    const base = {
      owner: 'tab',
      phase: 'page' as const,
      selectedRelays: ['wss://relay'],
      authors: ['b'.repeat(64)],
      pageSize: 30,
      direction: 'older' as const,
      cursor: { createdAt: 1_700_000_000, id: 'a'.repeat(64) },
      purpose: 'feed' as const,
    };

    const home = pageIntentSemanticKey({ ...base, surface: 'home' });
    const profile = pageIntentSemanticKey({
      ...base,
      surface: 'profile',
      routeFingerprint: 'profile-routes',
    });
    const notifications = pageIntentSemanticKey({
      ...base,
      surface: 'notifications',
    });

    expect(new Set([home, profile, notifications]).size).toBe(3);
  });
});
