import { beforeEach, describe, expect, it } from 'vitest';
import { cacheStatus } from '../../../src/lib/cache/cache-status';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('cache status', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('counts unique metadata profile pubkeys from cache fallback', async () => {
    await upsertEvent(event('1', 'a'));
    await upsertEvent(event('2', 'a'));
    await upsertEvent({ ...event('3', 'b'), kind: 1 });
    expect((await cacheStatus()).profileCount).toBe(1);
  });
});

function event(seed: string, pubkeySeed: string): NostrEvent {
  return {
    id: seed.repeat(64),
    pubkey: pubkeySeed.repeat(64),
    created_at: Number(seed),
    kind: 0,
    tags: [],
    content: '{}',
    sig: 'f'.repeat(128),
  };
}
