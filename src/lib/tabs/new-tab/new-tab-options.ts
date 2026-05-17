import type { TabKind } from '$lib/workspace/tab';

export type NewTabOption = {
  readonly kind: TabKind;
  readonly label: string;
  readonly description: string;
  readonly needsInput?: 'profile' | 'thread' | 'filter';
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
    kind: 'profile',
    label: 'Profile',
    description: 'Identity and posts.',
    needsInput: 'profile',
    group: 'primary',
  },
  {
    kind: 'relay-settings',
    label: 'Relay Settings',
    description: 'Relay sets.',
    group: 'primary',
  },
  {
    kind: 'post-manager',
    label: 'Posts',
    description: 'Draft tree.',
    group: 'primary',
  },
  {
    kind: 'notifications',
    label: 'Notifications',
    description: 'Account activity.',
    group: 'primary',
  },
  {
    kind: 'settings',
    label: 'Settings',
    description: 'Key-value editor.',
    group: 'primary',
  },
  {
    kind: 'account-manager',
    label: 'Accounts',
    description: 'Identity list.',
    group: 'secondary',
  },
  {
    kind: 'composer',
    label: 'Composer',
    description: 'Single note draft.',
    group: 'secondary',
  },
  {
    kind: 'cache-status',
    label: 'Cache',
    description: 'Local storage.',
    group: 'secondary',
  },
  {
    kind: 'thread',
    label: 'Thread',
    description: 'Event by id.',
    needsInput: 'thread',
    group: 'secondary',
  },
  {
    kind: 'timeline',
    label: 'Custom filter',
    description: 'Filter JSON.',
    needsInput: 'filter',
    group: 'secondary',
  },
];
