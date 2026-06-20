import { describe, expect, it } from 'vitest';
import { eventActionLabels } from '../../../src/lib/components/events/event-actions-label-plan';
import { planEventActionControls } from '../../../src/lib/components/events/event-actions-control-plan';

describe('event action control plan', () => {
  it('plans retained pressed and active action button state', () => {
    expect(
      planEventActionControls({
        busy: false,
        labels: eventActionLabels(),
        liked: true,
        mode: 'reply',
        reposted: false,
      }),
    ).toEqual({
      heart: {
        active: false,
        disabled: false,
        pressed: true,
        title: 'Heart',
      },
      reply: {
        active: true,
        disabled: false,
        pressed: false,
        title: 'Reply',
      },
      repost: {
        active: false,
        disabled: false,
        pressed: false,
        title: 'Repost',
      },
      zap: {
        active: false,
        disabled: false,
        pressed: false,
        title: 'Zap',
      },
    });
  });

  it('disables retained action buttons while publish work is busy', () => {
    const plan = planEventActionControls({
      busy: true,
      labels: eventActionLabels(),
      liked: false,
      mode: 'zap',
      reposted: true,
    });

    expect(plan.heart.disabled).toBe(true);
    expect(plan.repost).toMatchObject({ disabled: true, pressed: true });
    expect(plan.reply).toMatchObject({ active: false, disabled: true });
    expect(plan.zap).toMatchObject({ active: true, disabled: true });
  });
});
