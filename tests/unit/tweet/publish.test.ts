import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent, UnsignedNostrEvent } from '../../../src/lib/protocol';

const pubkey = 'a'.repeat(64);
const event: NostrEvent = {
  id: 'b'.repeat(64),
  pubkey,
  created_at: 1,
  kind: 1,
  tags: [],
  content: 'hello',
  sig: 'c'.repeat(128),
};

describe('Tweet publish', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('keeps relay delivery alive when local archive storage fails', async () => {
    const store = vi.fn(async () => {
      throw new Error('Protected storage is busy in another tab.');
    });
    const publish = vi.fn(() =>
      Promise.resolve([{ relay: 'wss://relay.example/', accepted: true }]),
    );
    mockPublishDeps({ store, publish });

    const { publishTweet } = await import('../../../src/lib/tweet/publish');
    const result = await publishTweet(' hello ', []);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store).toHaveBeenCalledWith(event);
    expect(publish).toHaveBeenCalledWith(['wss://relay.example/'], event);
    expect(result.archiveWarning).toBe(
      'Local archive failed: Protected storage is busy in another tab.',
    );
    await expect(result.delivery).resolves.toEqual([
      { relay: 'wss://relay.example/', accepted: true },
    ]);
  });

  it('returns signer denial as a terminal publish failure', async () => {
    const publish = vi.fn();
    const store = vi.fn();
    mockPublishDeps({
      store,
      publish,
      signEvent: async () => {
        throw new Error('User denied signing.');
      },
    });

    const { publishTweet } = await import('../../../src/lib/tweet/publish');
    const result = await publishTweet('hello', []);

    expect(result).toEqual({ ok: false, message: 'User denied signing.' });
    expect(store).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});

function mockPublishDeps(input: {
  readonly store: (event: NostrEvent) => Promise<void> | void;
  readonly publish: (
    relays: readonly string[],
    event: NostrEvent,
  ) => Promise<unknown>;
  readonly signEvent?: (event: UnsignedNostrEvent) => Promise<NostrEvent>;
}): void {
  vi.doMock('../../../src/lib/accounts/signer', () => ({
    resolveActiveSigner: async () => ({
      account: { pubkey },
      signEvent: input.signEvent ?? (async () => event),
    }),
  }));
  vi.doMock('../../../src/lib/events/publish-client-tag', () => ({
    clientTaggedEvent: async (unsigned: UnsignedNostrEvent) => unsigned,
  }));
  vi.doMock('../../../src/lib/timeline/timeline-subscription', () => ({
    enabledWriteRelays: () => ['wss://relay.example/'],
  }));
  vi.doMock('../../../src/lib/timeline/timeline-store', () => ({
    storeTimelineEvent: input.store,
  }));
  vi.doMock('../../../src/lib/relays/relay-pool', () => ({
    sharedRelayPool: { publish: input.publish },
  }));
}
