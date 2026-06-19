import { describe, expect, it, vi } from 'vitest';
import type { FeedCursorPoint, FeedEvent } from '../../../src/lib/events/types';
import { createProfilePageLoaders } from '../../../src/lib/profile/profile-runtime-loaders';
import {
  emptyProfileState,
  type ProfileState,
} from '../../../src/lib/profile/profile-state';

type OlderPage = {
  readonly posts: readonly FeedEvent[];
  readonly hasOlder: boolean;
  readonly newerPruned: boolean;
  readonly nextOlderCursor?: FeedCursorPoint;
};

const pages = vi.hoisted(() => ({
  older: undefined as OlderPage | undefined,
}));

vi.mock('../../../src/lib/profile/profile-runtime-paging', () => ({
  loadOlderProfilePage: vi.fn(async () => pages.older),
  loadNewerProfilePage: vi.fn(),
}));

describe('profile runtime loaders', () => {
  it('merges older pages directly without transient row shells', async () => {
    const post = feedEvent('older');
    pages.older = {
      posts: [post],
      hasOlder: false,
      newerPruned: true,
    };

    let olderCursor: FeedCursorPoint | undefined = cursor(9, 'cursor');
    let state: ProfileState = {
      ...emptyProfileState(),
      loading: false,
      hasOlder: true,
      oldestCursor: olderCursor,
    };
    const emissions: ProfileState[] = [];
    const loaders = createProfilePageLoaders({
      pubkey: post.event.pubkey,
      relays: ['wss://relay.example/'],
      owner: 'profile-loader-test',
      pageSize: 30,
      subscriptions: {} as never,
      signal: new AbortController().signal,
      isClosed: () => false,
      active: () => true,
      generation: () => 1,
      getState: () => state,
      emit: (next) => {
        state = next;
        emissions.push(next);
      },
      getOlderCursor: () => olderCursor,
      setOlderCursor: (next) => {
        olderCursor = next;
      },
      getNewerCursor: () => undefined,
      setNewerCursor: () => undefined,
    });

    await loaders.loadOlder({ preserve: 'older' });

    expect(emissions).toHaveLength(3);
    expect(emissions[0]?.loadingOlder).toBe(true);
    expect(emissions[1]?.posts[0]).toBe(post);
    expect(emissions[1]).toMatchObject({
      hasOlder: false,
      hasNewer: true,
      newerPruned: true,
      loadingOlder: true,
    });
    expect(emissions[2]?.loadingOlder).toBe(false);
    expect(olderCursor).toBeUndefined();
  });
});

function feedEvent(seed: string): FeedEvent {
  return {
    event: {
      id: seed.padEnd(64, '0').slice(0, 64),
      pubkey: 'a'.repeat(64),
      created_at: 10,
      kind: 1,
      tags: [],
      content: 'real profile note',
      sig: 'b'.repeat(128),
    },
    relays: ['wss://relay.example/'],
  };
}

function cursor(createdAt: number, seed: string): FeedCursorPoint {
  return { createdAt, id: seed.padEnd(64, '0').slice(0, 64) };
}
