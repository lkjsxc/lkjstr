import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSensitiveRevealsForTests,
  isSensitiveEventRevealed,
  revealSensitiveEvent,
} from '../../../src/lib/events/sensitive-reveal';

describe('sensitive reveal session store', () => {
  beforeEach(() => clearSensitiveRevealsForTests());

  it('keeps revealed events for the current app session', () => {
    const eventId = 'a'.repeat(64);
    expect(isSensitiveEventRevealed(eventId)).toBe(false);
    revealSensitiveEvent(eventId);
    expect(isSensitiveEventRevealed(eventId)).toBe(true);
    expect(isSensitiveEventRevealed('b'.repeat(64))).toBe(false);
  });
});
