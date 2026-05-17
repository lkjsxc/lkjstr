export type TabKind =
  | 'timeline'
  | 'notifications'
  | 'profile'
  | 'account-manager'
  | 'post-manager'
  | 'thread'
  | 'relay-monitor'
  | 'composer'
  | 'settings'
  | 'cache-status';

export type WorkspaceTab = {
  readonly id: string;
  readonly kind: TabKind;
  readonly title: string;
  readonly icon: string;
  readonly avatarUrl?: string | null;
  readonly unreadCount?: number;
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
    timeline: 'list',
    notifications: 'bell',
    profile: 'user',
    'account-manager': 'users',
    'post-manager': 'tree',
    thread: 'message',
    'relay-monitor': 'radio',
    composer: 'edit',
    settings: 'settings',
    'cache-status': 'database',
  };
  return icons[kind];
}

export function touchTab(tab: WorkspaceTab): WorkspaceTab {
  return { ...tab, updatedAt: Date.now() };
}
