import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRelayRequestCompatibilityForTests,
  recordRelayClosedPolicy,
  relayRequestCompatibilitySizeForTests,
} from '../../../src/lib/relays/relay-request-compat';

describe('relay request compatibility evidence', () => {
  beforeEach(() => {
    clearRelayRequestCompatibilityForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bounds relay policy evidence', () => {
    for (let index = 0; index < 251; index += 1) {
      recordRelayClosedPolicy(
        `wss://relay-${index}.example/`,
        'requires kinds',
        [{}],
      );
    }

    expect(relayRequestCompatibilitySizeForTests()).toBe(250);
  });
});
