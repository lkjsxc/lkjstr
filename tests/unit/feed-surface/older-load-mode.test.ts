import { describe, expect, it } from 'vitest';
import { canRequestOlder } from '../../../src/lib/feed-surface/older-load-mode';

describe('older load mode', () => {
  it('allows automatic near-end loads for auto mode', () => {
    expect(
      canRequestOlder({
        mode: 'auto-near-end',
        trigger: 'near-end',
        userScrolledDown: false,
      }),
    ).toBe(true);
  });

  it('requires downward user intent for after-user-scroll mode', () => {
    expect(
      canRequestOlder({
        mode: 'after-user-scroll',
        trigger: 'viewport-fill',
        userScrolledDown: false,
      }),
    ).toBe(false);
    expect(
      canRequestOlder({
        mode: 'after-user-scroll',
        trigger: 'scroll',
        userScrolledDown: true,
      }),
    ).toBe(true);
  });

  it('keeps explicit mode footer-owned', () => {
    expect(
      canRequestOlder({
        mode: 'explicit',
        trigger: 'near-end',
        userScrolledDown: true,
      }),
    ).toBe(false);
    expect(
      canRequestOlder({
        mode: 'explicit',
        trigger: 'explicit',
        userScrolledDown: false,
      }),
    ).toBe(true);
  });
});
