import { describe, expect, it } from 'vitest';
import {
  captureRuntimeSnapshot,
  clearRuntimeSnapshot,
  registerTabRuntimeSnapshot,
} from '../../../src/lib/workspace/tab-runtime-registry';

describe('tab runtime registry', () => {
  it('keeps the last snapshot after unregister', () => {
    const release = registerTabRuntimeSnapshot('search', () => ({
      kind: 'tool',
      fields: { searchQuery: 'nostr' },
    }));
    const live = captureRuntimeSnapshot('search');
    expect(live?.kind === 'tool' && live.fields?.searchQuery).toBe('nostr');
    release();
    const cached = captureRuntimeSnapshot('search');
    expect(cached?.kind === 'tool' && cached.fields?.searchQuery).toBe('nostr');
    clearRuntimeSnapshot('search');
    expect(captureRuntimeSnapshot('search')).toBeUndefined();
  });
});
