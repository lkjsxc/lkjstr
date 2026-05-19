import type { TabKind } from './tab';

export function titleFor(kind: TabKind): string {
  const titles: Record<TabKind, string> = {
    'new-tab': 'New Tab',
    timeline: 'Home',
    global: 'Global',
    notifications: 'Notifications',
    profile: 'Profile',
    'account-manager': 'Accounts',
    thread: 'Thread',
    'relay-monitor': 'lkjstr Log',
    'relay-settings': 'Relay Settings',
    tweet: 'Tweet',
    settings: 'Settings',
    'cache-status': 'Cache',
  };
  return titles[kind];
}
