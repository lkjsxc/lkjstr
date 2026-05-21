import type { TabKind } from '$lib/workspace/tab';

export type NewTabOption = {
  readonly kind: TabKind;
  readonly label: string;
  readonly description: string;
  readonly group: 'primary' | 'secondary';
};

export const newTabOptions: readonly NewTabOption[] = [
  {
    kind: 'timeline',
    label: 'Home',
    description: 'Account follows.',
    group: 'primary',
  },
  {
    kind: 'tweet',
    label: 'Tweet',
    description: 'Single note draft.',
    group: 'primary',
  },
  {
    kind: 'notifications',
    label: 'Notifications',
    description: 'Account activity.',
    group: 'primary',
  },
  {
    kind: 'search',
    label: 'Search',
    description: 'Ego search.',
    group: 'primary',
  },
  {
    kind: 'global',
    label: 'Global',
    description: 'Relay notes.',
    group: 'primary',
  },
  {
    kind: 'profile-edit',
    label: 'Profile Edit',
    description: 'Active account metadata.',
    group: 'primary',
  },
  {
    kind: 'account-manager',
    label: 'Accounts',
    description: 'Identity list.',
    group: 'primary',
  },
  {
    kind: 'relay-settings',
    label: 'Relay Settings',
    description: 'Relay sets.',
    group: 'primary',
  },
  {
    kind: 'network-stats',
    label: 'Stats',
    description: 'Network counters.',
    group: 'primary',
  },
  {
    kind: 'settings',
    label: 'Settings',
    description: 'Key-value editor.',
    group: 'secondary',
  },
  {
    kind: 'upload-settings',
    label: 'Upload Settings',
    description: 'Media upload.',
    group: 'secondary',
  },
  {
    kind: 'relay-monitor',
    label: 'lkjstr Log',
    description: 'Session diagnostics.',
    group: 'secondary',
  },
  {
    kind: 'npub-miner',
    label: 'Mine npub',
    description: 'Vanity key search.',
    group: 'secondary',
  },
  {
    kind: 'welcome',
    label: 'Welcome',
    description: 'Startup guide.',
    group: 'secondary',
  },
];
