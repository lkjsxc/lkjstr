import type { TabKind } from './tab';

export function titleFor(kind: TabKind): string {
  const titles: Record<TabKind, string> = {
    timeline: 'Home',
    notifications: 'Notifications',
    profile: 'Profile',
    'account-manager': 'Accounts',
    'post-manager': 'Posts',
    thread: 'Thread',
    'relay-monitor': 'Relays',
    composer: 'Compose',
    settings: 'Settings',
    'cache-status': 'Cache',
  };
  return titles[kind];
}
