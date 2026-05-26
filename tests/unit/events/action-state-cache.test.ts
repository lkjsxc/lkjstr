import { describe, expect, it } from 'vitest';
import { mergeActionStateMaps } from '../../../src/lib/events/action-state-cache';

describe('mergeActionStateMaps', () => {
  it('combines liked and reposted flags', () => {
    const base = new Map([['a', { liked: true, reposted: false }]]);
    const extra = new Map([
      ['a', { liked: false, reposted: true }],
      ['b', { liked: false, reposted: true }],
    ]);
    const merged = mergeActionStateMaps(base, extra);
    expect(merged.get('a')).toEqual({ liked: true, reposted: true });
    expect(merged.get('b')).toEqual({ liked: false, reposted: true });
  });
});
