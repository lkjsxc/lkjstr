import { describe, expect, it } from 'vitest';
import { leaseFingerprint } from '../../../../src/lib/relays/orchestration/lease-fingerprint';

describe('leaseFingerprint', () => {
  it('is stable for equivalent filters', () => {
    const a = leaseFingerprint({
      relays: ['wss://b', 'wss://a'],
      filters: [{ kinds: [1], authors: ['b', 'a'], limit: 30 }],
      phase: 'live',
      purpose: 'feed',
    });
    const b = leaseFingerprint({
      relays: ['wss://a', 'wss://b'],
      filters: [{ kinds: [1], authors: ['a', 'b'], limit: 30 }],
      phase: 'live',
      purpose: 'feed',
    });
    expect(a).toBe(b);
  });

  it('differs by phase', () => {
    const base = {
      relays: ['wss://a'],
      filters: [{ kinds: [1], limit: 30 }],
      purpose: 'feed' as const,
    };
    expect(
      leaseFingerprint({ ...base, phase: 'live' }),
    ).not.toBe(leaseFingerprint({ ...base, phase: 'bootstrap' }));
  });
});
