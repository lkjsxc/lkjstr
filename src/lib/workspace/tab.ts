export type TabKind =
  | 'welcome'
  | 'new-tab'
  | 'timeline'
  | 'global'
  | 'public-chat'
  | 'notifications'
  | 'profile'
  | 'profile-edit'
  | 'upload-settings'
  | 'account-manager'
  | 'npub-miner'
  | 'thread'
  | 'relay-monitor'
  | 'relay-settings'
  | 'network-stats'
  | 'search'
  | 'custom-request'
  | 'author-context'
  | 'tweet'
  | 'settings';

export type WorkspaceTab = {
  readonly id: string;
  readonly kind: TabKind;
  readonly title: string;
  readonly icon: string;
  readonly avatarUrl?: string | null;
  readonly dirty?: boolean;
  readonly loading?: boolean;
  readonly accountId?: string | null;
  readonly config: Record<string, unknown>;
  readonly state: Record<string, unknown>;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export function createTab(
  kind: TabKind,
  title: string,
  config: Record<string, unknown> = {},
): WorkspaceTab {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    icon: iconFor(kind),
    config,
    state: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function iconFor(kind: TabKind): string {
  const icons: Record<TabKind, string> = {
    welcome: 'star',
    'new-tab': 'plus',
    timeline: 'list',
    global: 'globe',
    'public-chat': 'message',
    notifications: 'bell',
    profile: 'user',
    'profile-edit': 'id-card',
    'upload-settings': 'upload',
    'account-manager': 'users',
    'npub-miner': 'pickaxe',
    thread: 'message',
    'relay-monitor': 'radio',
    'relay-settings': 'sliders',
    'network-stats': 'activity',
    search: 'search',
    'custom-request': 'braces',
    'author-context': 'user-round-search',
    tweet: 'edit',
    settings: 'settings',
  };
  return icons[kind];
}

export function touchTab(tab: WorkspaceTab): WorkspaceTab {
  return { ...tab, updatedAt: Date.now() };
}

export function convertTab(
  tab: WorkspaceTab,
  kind: TabKind,
  title: string,
  config: Record<string, unknown> = {},
): WorkspaceTab {
  return {
    ...tab,
    kind,
    title,
    icon: iconFor(kind),
    config,
    state: {},
    updatedAt: Date.now(),
  };
}
