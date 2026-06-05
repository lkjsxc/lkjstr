import type { TabKind } from '$lib/workspace/tab';

export type NewTabOption = {
  readonly kind: TabKind;
  readonly label: string;
  readonly description: string;
  readonly group: 'primary' | 'secondary';
  readonly aliases?: readonly string[];
  readonly config?: Record<string, unknown>;
};

const baseOptions: readonly NewTabOption[] = [
  {
    kind: 'timeline',
    label: 'Home',
    description: 'Account follows.',
    group: 'primary',
    aliases: ['timeline', 'follows'],
  },
  {
    kind: 'tweet',
    label: 'Tweet',
    description: 'Single note draft.',
    group: 'primary',
    aliases: ['note', 'post', 'compose'],
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
    aliases: ['firehose', 'relay'],
  },
  {
    kind: 'public-chat',
    label: 'Public Chat',
    description: 'NIP-28 channel chat.',
    group: 'primary',
    aliases: ['chat', 'channel', 'nip28', 'room', 'public'],
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
    aliases: ['diagnostics', 'log'],
  },
  {
    kind: 'npub-miner',
    label: 'Mine npub',
    description: 'Vanity key search.',
    group: 'secondary',
    aliases: ['vanity', 'key'],
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
    aliases: ['profile', 'me'],
    config: { pubkey: activePubkey },
  };
  const publicChatIndex = baseOptions.findIndex(
    (o) => o.kind === 'public-chat',
  );
  const insertIndex =
    publicChatIndex >= 0 ? publicChatIndex + 1 : baseOptions.length;
  return [
    ...baseOptions.slice(0, insertIndex),
    profile,
    ...baseOptions.slice(insertIndex),
  ];
}

export function normalizeNewTabQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function newTabOptionSearchText(option: NewTabOption): string {
  return [
    option.label,
    option.description,
    option.kind,
    option.group,
    ...(option.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

export function newTabOptionMatches(
  option: NewTabOption,
  query: string,
): boolean {
  const normalized = normalizeNewTabQuery(query);
  return (
    normalized === '' || newTabOptionSearchText(option).includes(normalized)
  );
}

export function filterNewTabOptions(
  options: readonly NewTabOption[],
  query: string,
): readonly NewTabOption[] {
  const normalized = normalizeNewTabQuery(query);
  if (normalized === '') return options;
  return options.filter((option) =>
    newTabOptionSearchText(option).includes(normalized),
  );
}

export function newTabOptionsForAccountAndQuery(
  activePubkey: string | undefined,
  query: string,
): readonly NewTabOption[] {
  return filterNewTabOptions(newTabOptionsForAccount(activePubkey), query);
}
