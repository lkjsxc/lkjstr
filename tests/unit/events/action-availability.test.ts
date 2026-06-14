import { describe, expect, it } from 'vitest';
import {
  hasOpenProfileAction,
  hasOpenThreadAction,
} from '../../../src/lib/components/events/action-availability';

describe('event action availability', () => {
  it('requires a real thread callback before rendering thread actions', () => {
    expect(hasOpenThreadAction(undefined)).toBe(false);
    expect(hasOpenThreadAction(() => undefined)).toBe(true);
  });

  it('requires a real profile callback before rendering profile actions', () => {
    expect(hasOpenProfileAction(undefined)).toBe(false);
    expect(hasOpenProfileAction(() => undefined)).toBe(true);
  });
});
