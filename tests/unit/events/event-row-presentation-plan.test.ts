import { describe, expect, it } from 'vitest';
import { planEventRowPresentation } from '../../../src/lib/components/events/event-row-presentation-plan';

describe('event row presentation plan', () => {
  it('keeps retained profile and thread actions unavailable without real openers', () => {
    expect(
      planEventRowPresentation({
        depth: undefined,
        openProfile: undefined,
        openThread: undefined,
      }),
    ).toEqual({
      depthStyle: '--event-depth: 0',
      profile: {
        label: 'Open profile',
        openable: false,
      },
      thread: {
        openable: false,
      },
    });
  });

  it('plans retained profile and thread affordances from real callbacks', () => {
    const plan = planEventRowPresentation({
      depth: 3,
      openProfile: () => undefined,
      openThread: () => undefined,
    });

    expect(plan).toEqual({
      depthStyle: '--event-depth: 3',
      profile: {
        label: 'Open profile',
        openable: true,
      },
      thread: {
        openable: true,
      },
    });
  });
});
