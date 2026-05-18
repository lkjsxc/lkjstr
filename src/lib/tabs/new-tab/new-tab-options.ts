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
    label: 'Timeline',
    description: 'Global notes.',
    group: 'primary',
  },
  {
    kind: 'relay-settings',
    label: 'Relay Settings',
    description: 'Relay sets.',
    group: 'primary',
  },
  {
    kind: 'relay-monitor',
    label: 'Relay Monitor',
    description: 'Relay status.',
    group: 'primary',
  },
  {
    kind: 'notifications',
    label: 'Notifications',
    description: 'Account activity.',
    group: 'primary',
  },
  {
    kind: 'account-manager',
    label: 'Accounts',
    description: 'Identity list.',
    group: 'secondary',
  },
  {
    kind: 'tweet',
    label: 'Tweet',
    description: 'Single note draft.',
    group: 'secondary',
  },
  {
    kind: 'settings',
    label: 'Settings',
    description: 'Key-value editor.',
    group: 'secondary',
  },
  {
    kind: 'cache-status',
    label: 'Cache',
    description: 'Local storage.',
    group: 'secondary',
  },
];
