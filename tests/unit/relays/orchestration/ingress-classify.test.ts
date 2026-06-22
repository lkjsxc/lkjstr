import { describe, expect, it } from 'vitest';
import { isRenderCriticalForSurface } from '../../../../src/lib/relays/orchestration/ingress-classify';
import type { NostrEvent } from '../../../../src/lib/protocol';

describe('relay ingress classification', () => {
  it('keeps Public Chat live subscriptions limited to NIP-28 events', () => {
    expect(isRenderCriticalForSurface('public-chat', event(40))).toBe(true);
    expect(isRenderCriticalForSurface('public-chat', event(42))).toBe(true);
    expect(isRenderCriticalForSurface('public-chat', event(7))).toBe(false);
  });

  it('keeps generic tool surfaces permissive for explicit requests', () => {
    expect(isRenderCriticalForSurface('custom-request', event(30_030))).toBe(
      true,
    );
  });
});

function event(kind: number): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: '1'.repeat(64),
    created_at: 1,
    kind,
    tags: [],
    content: '',
    sig: '2'.repeat(128),
  };
}
