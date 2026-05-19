import { beforeEach, describe, expect, it } from 'vitest';
import { ThreadRuntime } from '../../../src/lib/thread/thread-runtime';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import { storeThreadEvent } from '../../../src/lib/thread/thread-store';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

describe('thread runtime', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('reports no enabled read relays without opening sockets', async () => {
    const states: string[] = [];
    const runtime = new ThreadRuntime(
      'a'.repeat(64),
      [],
      'thread-test',
      new RelayPool(),
    );
    runtime.subscribe((state) =>
      states.push(`${state.loading}:${state.error ?? ''}`),
    );
    await runtime.start();
    expect(states.at(-1)).toBe('false:No enabled read relays.');
  });

  it('clears loadingOlder when an older page fails', async () => {
    const root = 'a'.repeat(64);
    await storeThreadEvent(event(root, 10));
    const states: string[] = [];
    const runtime = new ThreadRuntime(
      root,
      ['wss://relay.example/'],
      'thread-test',
      new RelayPool(),
      failingSubscriptions(),
    );
    runtime.subscribe((state) =>
      states.push(`${state.loadingOlder}:${state.error ?? ''}`),
    );
    await runtime.start();
    await runtime.loadOlder();
    expect(states.at(-1)).toBe('false:older failed');
  });
});

function failingSubscriptions(): RelaySubscriptionManager {
  return {
    subscribeState: () => () => undefined,
    subscribeLive: () => () => undefined,
    readPage: async () => {
      throw new Error('older failed');
    },
  } as unknown as RelaySubscriptionManager;
}

function event(id: string, created_at: number) {
  return {
    id,
    pubkey: 'b'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: 'root',
    sig: 'c'.repeat(128),
  };
}
