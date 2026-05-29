import type { TabKind } from '$lib/workspace/tab';

export type NewTabOption = {
  readonly kind: TabKind;
  readonly label: string;
  readonly description: string;
  readonly group: 'primary' | 'secondary';
  readonly config?: Record<string, unknown>;
};

const baseOptions: readonly NewTabOption[] = [
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
    description: 'Event text lookup.',
    group: 'primary',
  },
  {
    kind: 'custom-request',
    label: 'Custom Request',
    description: 'Validated relay filters.',
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

export function newTabOptionsForAccount(
  activePubkey?: string,
): readonly NewTabOption[] {
  if (!activePubkey) return baseOptions;
  const profile: NewTabOption = {
    kind: 'profile',
    label: 'My Profile',
    description: 'Active account profile.',
    group: 'primary',
    config: { pubkey: activePubkey },
  };
  const globalIndex = baseOptions.findIndex((o) => o.kind === 'global');
  return [
    ...baseOptions.slice(0, globalIndex + 1),
    profile,
    ...baseOptions.slice(globalIndex + 1),
  ];
}
