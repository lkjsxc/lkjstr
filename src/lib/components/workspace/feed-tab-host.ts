import type { WorkspaceTab } from '$lib/workspace/tab';
import type { RustIslandHandle } from './RustIslandHost.svelte';

export type FeedTabMount = (
  parent: HTMLElement,
) => RustIslandHandle | Promise<RustIslandHandle>;

export type FeedTabMounts = {
  timeline: FeedTabMount;
  global: FeedTabMount;
  search: FeedTabMount;
  customRequest: FeedTabMount;
  notifications: FeedTabMount;
  authorContext: FeedTabMount;
  profile: FeedTabMount;
  followees: FeedTabMount;
  userTimeline: FeedTabMount;
  thread: FeedTabMount;
};

export type FeedTabHost = {
  label: string;
  className: string;
  mountKey: string;
  fallbackError: string;
  status?: string;
  mount: FeedTabMount;
};

type FeedTabHostInput = {
  tab: WorkspaceTab;
  visible: boolean;
  activePubkey?: string;
  followeesCopyStatus: string;
  mounts: FeedTabMounts;
};

export function feedTabHost(input: FeedTabHostInput): FeedTabHost | undefined {
  const { tab, mounts } = input;
  switch (tab.kind) {
    case 'timeline':
      return island('Home', 'timeline-tab', accountKey(input), mounts.timeline);
    case 'global':
      return island('Global', 'timeline-tab', tabIdKey(input), mounts.global);
    case 'search':
      return island('Search', 'timeline-tab', tabIdKey(input), mounts.search);
    case 'custom-request':
      return island(
        'Custom Request',
        'timeline-tab',
        tabIdKey(input),
        mounts.customRequest,
      );
    case 'notifications':
      return island(
        'Notifications',
        'timeline-tab',
        accountKey(input),
        mounts.notifications,
      );
    case 'author-context':
      return island(
        'Author Context',
        'timeline-tab',
        visibleKey(
          input,
          `${tab.id}:${tab.config.eventId ?? ''}:${tab.config.pubkey ?? ''}`,
        ),
        mounts.authorContext,
      );
    case 'profile':
      return island(
        'Profile',
        'profile-tab',
        visibleKey(
          input,
          `${tab.id}:${tab.config.pubkey ?? ''}:${input.activePubkey ?? ''}`,
        ),
        mounts.profile,
      );
    case 'followees':
      return {
        ...island(
          'Following',
          'followees-tab',
          tabPubkeyKey(input),
          mounts.followees,
        ),
        fallbackError: 'Followees failed.',
        status: input.followeesCopyStatus,
      };
    case 'user-timeline':
      return island(
        'User Timeline',
        'user-timeline-tab',
        tabPubkeyKey(input),
        mounts.userTimeline,
      );
    case 'thread':
      return island(
        'Thread',
        'timeline-tab',
        visibleKey(input, `${tab.id}:${tab.config.eventId ?? ''}`),
        mounts.thread,
      );
  }
}

function island(
  label: string,
  className: string,
  mountKey: string,
  mount: FeedTabMount,
): FeedTabHost {
  return {
    label,
    className,
    mountKey,
    fallbackError: `${label} failed.`,
    mount,
  };
}

function visibleKey(input: FeedTabHostInput, key: string): string {
  return input.visible ? key : '';
}

function tabIdKey(input: FeedTabHostInput): string {
  return visibleKey(input, input.tab.id);
}

function tabPubkeyKey(input: FeedTabHostInput): string {
  return visibleKey(input, `${input.tab.id}:${input.tab.config.pubkey ?? ''}`);
}

function accountKey(input: FeedTabHostInput): string {
  return visibleKey(input, `${input.tab.id}:${input.activePubkey ?? ''}`);
}
