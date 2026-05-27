import { beforeEach, describe, expect, it } from 'vitest';
import { feedWindowSize } from '../../../src/lib/events/feed-window';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import {
  clearRelayRoutesForTests,
  saveAuthorRelayRoute,
} from '../../../src/lib/relays/relay-route-store';
import {
  emptySubscriptions,
  event,
  initialSubscriptions,
  type ReadRequest,
} from './profile-runtime-paging-helpers';
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
      owner: 'profile-test',
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
      owner: 'profile-test',
      cursor: {
        createdAt: posts.at(-1)!.event.created_at,
        id: posts.at(-1)!.event.id,
      },
      pageSize: 30,
      subscriptions: emptySubscriptions(),
      preserve: 'older',
    });
    expect(olderPage.newerPruned).toBe(true);
    expect(olderPage.posts[0]?.event.created_at).toBe(299);

    const newerPage = await loadNewerProfilePage({
      posts: olderPage.posts,
      pubkey,
      relays: [],
      owner: 'profile-test',
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

  it('preserves newest profile rows by default for accidental older loads', async () => {
    const pubkey = 'c'.repeat(64);
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
      owner: 'profile-test',
      cursor: {
        createdAt: posts.at(-1)!.event.created_at,
        id: posts.at(-1)!.event.id,
      },
      pageSize: 30,
      subscriptions: emptySubscriptions(),
    });

    expect(olderPage.newerPruned).toBe(false);
    expect(olderPage.posts[0]?.event.created_at).toBe(300);
  });

  it('does not display future profile relay notes', async () => {
    const pubkey = 'd'.repeat(64);
    const now = Math.floor(Date.now() / 1000);
    const page = await loadInitialProfilePage({
      posts: [],
      profile: null,
      relays: ['wss://relay-a/'],
      pubkey,
      owner: 'profile-test',
      pageSize: 30,
      followList: undefined,
      subscriptions: initialSubscriptions(pubkey, [
        event('future', now + 60, pubkey, 1),
        event('current', now, pubkey, 1),
      ]),
    });

    expect(page.posts.map((item) => item.event.content)).toEqual(['{}']);
    expect(page.posts.map((item) => item.event.id)).toEqual([
      event('current', now, pubkey, 1).id,
    ]);
  });
});
