import { describe, expect, it } from 'vitest';
import {
  feedTabHost,
  type FeedTabMount,
  type FeedTabMounts,
} from '../../../src/lib/components/workspace/feed-tab-host';
import type { TabKind, WorkspaceTab } from '../../../src/lib/workspace/tab';

const mounts: FeedTabMounts = {
  timeline: mount(),
  global: mount(),
  search: mount(),
  customRequest: mount(),
  notifications: mount(),
  authorContext: mount(),
  profile: mount(),
  followees: mount(),
  userTimeline: mount(),
  thread: mount(),
};

function mount(): FeedTabMount {
  return () => ({ unmount: () => undefined });
}

function tab(
  kind: TabKind,
  config: Record<string, unknown> = {},
  id = `${kind}-tab`,
): WorkspaceTab {
  return {
    id,
    kind,
    title: kind,
    icon: kind,
    config,
    state: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

function select(
  workspaceTab: WorkspaceTab,
  visible = true,
  activePubkey = 'viewer',
) {
  return feedTabHost({
    tab: workspaceTab,
    visible,
    activePubkey,
    followeesCopyStatus: 'Copied',
    mounts,
  });
}

describe('feedTabHost', () => {
  it('routes non-feed tabs out of the Rust island host', () => {
    expect(select(tab('welcome'))).toBeUndefined();
    expect(select(tab('network-stats'))).toBeUndefined();
  });

  it('keeps hidden feed tabs unmounted with empty mount keys', () => {
    for (const hiddenTab of [
      tab('timeline', {}, 'home'),
      tab('global', {}, 'global'),
      tab('search', {}, 'search'),
      tab('custom-request', {}, 'custom'),
      tab('notifications', {}, 'notifications'),
      tab('author-context', { eventId: 'event', pubkey: 'author' }, 'author'),
      tab('profile', { pubkey: 'author' }, 'profile'),
      tab('followees', { pubkey: 'author' }, 'followees'),
      tab('user-timeline', { pubkey: 'author' }, 'user-timeline'),
      tab('thread', { eventId: 'event' }, 'thread'),
    ]) {
      expect(select(hiddenTab, false)?.mountKey).toBe('');
    }
  });

  it('keys account-scoped islands by active account', () => {
    expect(select(tab('timeline', {}, 'home'), true, 'alice')).toMatchObject({
      label: 'Home',
      className: 'timeline-tab',
      mountKey: 'home:alice',
      fallbackError: 'Home failed.',
    });
    expect(select(tab('timeline', {}, 'home'), true, 'bob')?.mountKey).toBe(
      'home:bob',
    );
    expect(
      select(tab('notifications', {}, 'notifications'), true, 'alice'),
    ).toMatchObject({
      label: 'Notifications',
      mountKey: 'notifications:alice',
    });
  });

  it('keys target-scoped islands by their tab config', () => {
    expect(
      select(
        tab('author-context', { eventId: 'root', pubkey: 'author' }, 'author'),
      ),
    ).toMatchObject({ mountKey: 'author:root:author' });
    expect(
      select(tab('profile', { pubkey: 'author' }, 'profile'), true, 'viewer'),
    ).toMatchObject({
      className: 'profile-tab',
      mountKey: 'profile:author:viewer',
    });
    expect(
      select(tab('followees', { pubkey: 'author' }, 'followees')),
    ).toMatchObject({
      label: 'Following',
      className: 'followees-tab',
      mountKey: 'followees:author',
      fallbackError: 'Followees failed.',
      status: 'Copied',
    });
    expect(
      select(tab('user-timeline', { pubkey: 'author' }, 'user')),
    ).toMatchObject({
      className: 'user-timeline-tab',
      mountKey: 'user:author',
    });
    expect(select(tab('thread', { eventId: 'root' }, 'thread'))).toMatchObject({
      mountKey: 'thread:root',
    });
  });

  it('routes each feed tab kind to its Rust island mounter', () => {
    expect(select(tab('timeline'))?.mount).toBe(mounts.timeline);
    expect(select(tab('global'))?.mount).toBe(mounts.global);
    expect(select(tab('search'))?.mount).toBe(mounts.search);
    expect(select(tab('custom-request'))?.mount).toBe(mounts.customRequest);
    expect(select(tab('notifications'))?.mount).toBe(mounts.notifications);
    expect(select(tab('author-context'))?.mount).toBe(mounts.authorContext);
    expect(select(tab('profile'))?.mount).toBe(mounts.profile);
    expect(select(tab('followees'))?.mount).toBe(mounts.followees);
    expect(select(tab('user-timeline'))?.mount).toBe(mounts.userTimeline);
    expect(select(tab('thread'))?.mount).toBe(mounts.thread);
  });
});
