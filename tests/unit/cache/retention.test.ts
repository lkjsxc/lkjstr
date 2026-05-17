import { describe, expect, it } from 'vitest';
import {
  canPruneDrafts,
  eventRetention,
} from '../../../src/lib/cache/retention';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('cache retention', () => {
  it('prunes old public events but never authorizes draft pruning', () => {
    const event: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      created_at: 10,
      kind: 1,
      tags: [],
      content: '',
      sig: 'c'.repeat(128),
    };
    expect(eventRetention(event, 1000, 100)).toBe('prune');
    expect(canPruneDrafts()).toBe(false);
  });
});
