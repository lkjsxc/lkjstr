import type { TabKind } from '$lib/workspace/tab';
export const lkjsxcTimelinePubkey =
  '0f38afb23cec30570ee64f9a4aa099229395ec3371c5fe867e09c9111480015d';

export type NewTabOption = {
  readonly kind: TabKind;
  readonly label: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly config?: Record<string, unknown>;
};
const baseOptions: readonly NewTabOption[] = [
  {
    kind: 'timeline',
    label: 'Home',
    description: 'Account follows.',
    aliases: ['timeline', 'follows'],
  },
  {
    kind: 'tweet',
    label: 'Tweet',
    description: 'Single note draft.',
    aliases: ['note', 'post', 'compose'],
  },
  {
    kind: 'notifications',
    label: 'Notifications',
    description: 'Account activity.',
  },
  {
    kind: 'search',
    label: 'Search',
    description: 'Event text lookup.',
  },
  {
    kind: 'custom-request',
    label: 'Custom Request',
    description: 'Validated relay filters.',
  },
  {
    kind: 'global',
    label: 'Global',
    description: 'Relay notes.',
    aliases: ['firehose', 'relay'],
  },
  {
    kind: 'public-chat',
    label: 'Public Chat',
    description: 'NIP-28 channel chat.',
    aliases: ['chat', 'channel', 'nip28', 'room', 'public'],
  },
  {
    kind: 'user-timeline',
    label: 'lkjsxc',
    description: "Show lkjsxc's public follow-graph timeline.",
    aliases: [
      'lkjsxc',
      'starter',
      'recommended',
      'public timeline',
      'npub1puu2',
    ],
    config: { pubkey: lkjsxcTimelinePubkey },
  },
  {
    kind: 'profile-edit',
    label: 'Profile Edit',
    description: 'Active account metadata.',
  },
  {
    kind: 'account-manager',
    label: 'Accounts',
    description: 'Identity list.',
  },
  {
    kind: 'relay-settings',
    label: 'Relay Settings',
    description: 'Relay sets.',
  },
  {
    kind: 'network-stats',
    label: 'Stats',
    description: 'Network counters.',
  },
  {
    kind: 'settings',
    label: 'Settings',
    description: 'Key-value editor.',
  },
  {
    kind: 'upload-settings',
    label: 'Upload Settings',
    description: 'Media upload.',
  },
  {
    kind: 'relay-monitor',
    label: 'lkjstr Log',
    description: 'Session diagnostics.',
    aliases: ['diagnostics', 'log'],
  },
  {
    kind: 'npub-miner',
    label: 'Mine npub',
    description: 'Vanity key search.',
    aliases: ['vanity', 'key'],
  },
  {
    kind: 'welcome',
    label: 'Welcome',
    description: 'Startup guide.',
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
    aliases: ['profile', 'me'],
    config: { pubkey: activePubkey },
  };
  const lkjstrIndex = baseOptions.findIndex((o) => o.label === 'lkjsxc');
  const publicChatIndex = baseOptions.findIndex(
    (o) => o.kind === 'public-chat',
  );
  const anchorIndex = lkjstrIndex >= 0 ? lkjstrIndex : publicChatIndex;
  const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : baseOptions.length;
  return [
    ...baseOptions.slice(0, insertIndex),
    profile,
    ...baseOptions.slice(insertIndex),
  ];
}
