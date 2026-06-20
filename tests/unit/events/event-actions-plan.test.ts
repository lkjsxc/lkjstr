import { describe, expect, it } from 'vitest';
import { toggleEventActionMode } from '../../../src/lib/components/events/event-actions-plan';

describe('event actions plan', () => {
  it('toggles inline action modes without opening duplicate panels', () => {
    expect(toggleEventActionMode('none', 'reply')).toBe('reply');
    expect(toggleEventActionMode('reply', 'reply')).toBe('none');
    expect(toggleEventActionMode('reply', 'zap')).toBe('zap');
  });
});
