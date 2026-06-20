import { describe, expect, it } from 'vitest';
import { eventActionLabels } from '../../../src/lib/components/events/event-actions-label-plan';

describe('event action label plan', () => {
  it('plans retained action button and reply labels', () => {
    expect(eventActionLabels()).toEqual({
      heart: 'Heart',
      publishReply: 'Publish reply',
      reply: 'Reply',
      repost: 'Repost',
      zap: 'Zap',
    });
  });
});
