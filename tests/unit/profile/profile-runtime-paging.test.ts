import { beforeEach, describe, expect, it } from 'vitest';
import { feedWindowSize } from '../../../src/lib/events/feed-window';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import {
  clearRelayRoutesForTests,
  saveAuthorRelayRoute,
} from '../../../src/lib/relays/relay-route-store';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import { loadInitialProfilePage } from '../../../src/lib/profile/profile-runtime-initial';
import {
  loadNewerProfilePage,
  loadOlderProfilePage,
} from '../../../src/lib/profile/profile-runtime-paging';

describe('profile runtime paging', () => {
  beforeEach(() => {
    clearEventRepositoryForTests();
    clearRelayRoutesForTests();
  });

  it('splits initial metadata, follows, and full post page reads', async () => {
    const pubkey = 'a'.repeat(64);
    const reads: ReadRequest[] = [];
    await saveAuthorRelayRoute({
      authorPubkey: pubkey,
      relayUrl: 'wss://purplepag.es/',
      source: 'event-receipt',
      purpose: 'write',
    });
    const posts = Array.from({ length: 30 }, (_, index) =>
      event(String(index + 1), 100 - index, pubkey, 1),
    );
    const page = await loadInitialProfilePage({
      posts: [],
      profile: null,
      relays: ['wss://relay-a/', 'wss://relay-b/'],
      pubkey,
      subId: 'profile-test',
      pageSize: 30,
      followList: undefined,
      subscriptions: initialSubscriptions(pubkey, posts, reads),
    });

    const metadataRead = reads.find((item) => item.kinds.includes(0));
    const followRead = reads.find((item) => item.kinds.includes(3));
    const postRead = reads.find((item) => item.kinds.includes(1));
    expect(metadataRead?.relays).toContain('wss://purplepag.es/');
    expect(followRead?.relays).not.toContain('wss://purplepag.es/');
    expect(postRead?.relays).not.toContain('wss://purplepag.es/');
    expect(postRead?.since).toEqual(expect.any(Number));
    expect(postRead?.until).toEqual(expect.any(Number));
    expect(page.profile?.pubkey).toBe(pubkey);
    expect(page.followList?.kind).toBe(3);
    expect(page.posts).toHaveLength(30);
    expect(page.posts[0]?.relays).toEqual(['wss://relay-a/', 'wss://relay-b/']);
    expect(page.posts.every((item) => item.event.kind === 1)).toBe(true);
  });

  it('recovers newer notes after older paging prunes the top window', async () => {
    const pubkey = 'b'.repeat(64);
    const posts = Array.from({ length: feedWindowSize }, (_, index) => ({
      event: event(String(index + 1), 300 - index, pubkey, 1),
      relays: ['cache'],
    }));
    for (const item of posts) await upsertEvent(item.event, item.relays);
    const older = { event: event('older', 120, pubkey, 1), relays: ['cache'] };
    await upsertEvent(older.event, older.relays);

    const olderPage = await loadOlderProfilePage({
      posts,
      pubkey,
      relays: [],
      subId: 'profile-test',
      cursor: {
        createdAt: posts.at(-1)!.event.created_at,
        id: posts.at(-1)!.event.id,
      },
      pageSize: 30,
      subscriptions: emptySubscriptions(),
    });
    expect(olderPage.newerPruned).toBe(true);
    expect(olderPage.posts[0]?.event.created_at).toBe(299);

    const newerPage = await loadNewerProfilePage({
      posts: olderPage.posts,
      pubkey,
      relays: [],
      subId: 'profile-test',
      cursor: {
        createdAt: olderPage.posts[0]!.event.created_at,
        id: olderPage.posts[0]!.event.id,
      },
      pageSize: 30,
      subscriptions: emptySubscriptions(),
    });
    expect(newerPage.posts[0]?.event.created_at).toBe(300);
    expect(newerPage.olderPruned).toBe(true);
  });
});

function initialSubscriptions(
  pubkey: string,
  posts: readonly NostrEvent[],
  reads: ReadRequest[] = [],
): RelaySubscriptionManager {
  return {
    readPage: async (request: {
      relays: readonly string[];
      filters: readonly { kinds?: number[] }[];
    }) => {
      const kinds = request.filters[0]?.kinds ?? [];
      reads.push({
        relays: [...request.relays],
        kinds,
        since: request.filters[0]?.since,
        until: request.filters[0]?.until,
      });
      if (kinds.includes(0))
        return [receipt(event('meta', 200, pubkey, 0), 'wss://relay-a/')];
      if (kinds.includes(3))
        return [receipt(event('follow', 190, pubkey, 3), 'wss://relay-a/')];
      return posts.flatMap((post, index) =>
        index === 0
          ? [receipt(post, 'wss://relay-b/'), receipt(post, 'wss://relay-a/')]
          : [receipt(post, 'wss://relay-a/')],
      );
    },
  } as unknown as RelaySubscriptionManager;
}

type ReadRequest = {
  readonly relays: readonly string[];
  readonly kinds: readonly number[];
  readonly since?: number;
  readonly until?: number;
};

function emptySubscriptions(): RelaySubscriptionManager {
  return { readPage: async () => [] } as unknown as RelaySubscriptionManager;
}

function receipt(event: NostrEvent, relay: string): PoolEvent {
  return { event, relay, subId: 'sub' };
}

function event(
  seed: string,
  created_at: number,
  pubkey: string,
  kind: number,
): NostrEvent {
  const id = [...seed]
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0')
    .slice(0, 64);
  return {
    id,
    pubkey,
    created_at,
    kind,
    tags: [],
    content: '{}',
    sig: 'c'.repeat(128),
  };
}
