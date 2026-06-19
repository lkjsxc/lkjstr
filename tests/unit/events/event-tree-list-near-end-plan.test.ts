import { describe, expect, it } from 'vitest';
import { planEventTreeListNearEnd } from '../../../src/lib/components/events/event-tree-list-near-end-plan';

describe('event tree list near-end plan', () => {
  it('requires both enabled state and a callback before firing near-end loads', () => {
    expect(
      planEventTreeListNearEnd({
        enabled: true,
        viewportHeight: 800,
      }),
    ).toMatchObject({ enabled: false, shouldObserve: true });

    expect(
      planEventTreeListNearEnd({
        enabled: true,
        viewportHeight: 800,
        onNearEnd: () => undefined,
      }),
    ).toMatchObject({ enabled: true, shouldObserve: true });
  });

  it('keeps a mounted scroller observable even while disabled', () => {
    expect(
      planEventTreeListNearEnd({
        enabled: false,
        viewportHeight: 800,
        scroller: {} as Element,
      }),
    ).toMatchObject({ enabled: false, shouldObserve: true });

    expect(
      planEventTreeListNearEnd({ enabled: false, viewportHeight: 800 }),
    ).toMatchObject({ enabled: false, shouldObserve: false });
  });

  it('uses the shared near-end root margin', () => {
    expect(
      planEventTreeListNearEnd({
        enabled: true,
        viewportHeight: 800,
        onNearEnd: () => undefined,
      }).rootMargin,
    ).toBe('1600px');
  });
});
