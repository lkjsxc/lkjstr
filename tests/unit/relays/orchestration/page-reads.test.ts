import { describe, expect, it } from 'vitest';
import { pageIntentSemanticKey } from '../../../../src/lib/relays/orchestration/page-reads';

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
});
