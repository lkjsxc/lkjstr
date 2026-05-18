import { describe, expect, it } from 'vitest';
import { ThreadRuntime } from '../../../src/lib/thread/thread-runtime';
import { RelayPool } from '../../../src/lib/relays/relay-pool';

describe('thread runtime', () => {
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
});
