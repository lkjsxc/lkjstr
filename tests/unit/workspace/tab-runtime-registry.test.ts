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
    expect(captureRuntimeSnapshot('search')?.fields?.searchQuery).toBe('nostr');
    release();
    expect(captureRuntimeSnapshot('search')?.fields?.searchQuery).toBe('nostr');
    clearRuntimeSnapshot('search');
    expect(captureRuntimeSnapshot('search')).toBeUndefined();
  });
});
