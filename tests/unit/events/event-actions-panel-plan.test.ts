import { describe, expect, it } from 'vitest';
import { eventActionLabels } from '../../../src/lib/components/events/event-actions-label-plan';
import { planEventActionPanel } from '../../../src/lib/components/events/event-actions-panel-plan';

describe('event actions panel plan', () => {
  it('keeps retained panels hidden when no inline mode is active', () => {
    expect(
      planEventActionPanel({
        mode: 'none',
        busy: false,
        reply: 'gm',
        labels: eventActionLabels(),
      }),
    ).toEqual({ kind: 'none' });
  });

  it('plans retained reply panel labels and submit availability', () => {
    expect(
      planEventActionPanel({
        mode: 'reply',
        busy: false,
        reply: ' gm ',
        labels: eventActionLabels(),
      }),
    ).toEqual({
      kind: 'reply',
      publishLabel: 'Publish reply',
      replyLabel: 'Reply',
      submitDisabled: false,
    });

    expect(
      planEventActionPanel({
        mode: 'reply',
        busy: true,
        reply: 'gm',
        labels: eventActionLabels(),
      }),
    ).toMatchObject({
      kind: 'reply',
      submitDisabled: true,
    });
  });

  it('plans retained zap panel visibility without reply controls', () => {
    expect(
      planEventActionPanel({
        mode: 'zap',
        busy: false,
        reply: '',
        labels: eventActionLabels(),
      }),
    ).toEqual({ kind: 'zap' });
  });
});
