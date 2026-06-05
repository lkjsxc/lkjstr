import type { TabKind } from './tab';

export function titleFor(kind: TabKind): string {
  const titles: Record<TabKind, string> = {
    welcome: 'Welcome',
    'new-tab': 'New Tab',
    timeline: 'Home',
    global: 'Global',
    'public-chat': 'Public Chat',
    notifications: 'Notifications',
    profile: 'Profile',
    'profile-edit': 'Profile Edit',
    'upload-settings': 'Upload Settings',
    'account-manager': 'Accounts',
    'npub-miner': 'Mine npub',
    thread: 'Thread',
    'relay-monitor': 'lkjstr Log',
    'relay-settings': 'Relay Settings',
    'network-stats': 'Stats',
    search: 'Search',
    'custom-request': 'Custom Request',
    'author-context': 'Author Context',
    tweet: 'Tweet',
    settings: 'Settings',
  };
  return titles[kind];
}
