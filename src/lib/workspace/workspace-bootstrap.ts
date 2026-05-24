import type { Workspace } from './workspace';

export const bootstrapWorkspaceId = 'main';

export function bootstrapWorkspace(): Workspace {
  const welcomeTabId = 'bootstrap-welcome-tab';
  const welcomeGroupId = 'bootstrap-welcome-group';
  const welcomePaneId = 'bootstrap-welcome-pane';
  const rightGroupId = 'bootstrap-main-group';
  const rightPaneId = 'bootstrap-main-pane';
  const tabs = [
    ['bootstrap-accounts-tab', 'account-manager', 'Accounts', 'users'],
    ['bootstrap-relays-tab', 'relay-settings', 'Relay Settings', 'sliders'],
    ['bootstrap-home-tab', 'timeline', 'Home', 'list'],
    ['bootstrap-notifications-tab', 'notifications', 'Notifications', 'bell'],
    ['bootstrap-tweet-tab', 'tweet', 'Tweet', 'edit'],
  ] as const;
  return {
    id: bootstrapWorkspaceId,
    name: 'Main workspace',
    layout: {
      id: 'bootstrap-root-split',
      type: 'split',
      direction: 'vertical',
      children: [
        pane(welcomePaneId, welcomeGroupId),
        pane(rightPaneId, rightGroupId),
      ],
      sizes: [0.4, 0.6],
    },
    tabGroups: {
      [welcomeGroupId]: {
        id: welcomeGroupId,
        tabIds: [welcomeTabId],
        activeTabId: welcomeTabId,
        pinnedTabIds: [],
        closedTabs: [],
      },
      [rightGroupId]: {
        id: rightGroupId,
        tabIds: tabs.map((tab) => tab[0]),
        activeTabId: 'bootstrap-accounts-tab',
        pinnedTabIds: [],
        closedTabs: [],
      },
    },
    tabs: {
      [welcomeTabId]: {
        id: welcomeTabId,
        kind: 'welcome',
        title: 'Welcome',
        icon: 'star',
        config: {},
        state: {},
        createdAt: 0,
        updatedAt: 0,
      },
      ...Object.fromEntries(
        tabs.map(([id, kind, title, icon]) => [
          id,
          {
            id,
            kind,
            title,
            icon,
            config: {},
            state: {},
            createdAt: 0,
            updatedAt: 0,
          },
        ]),
      ),
    },
    focusedPaneId: welcomePaneId,
    focusedTabId: welcomeTabId,
    activeAccountId: null,
    sidebarVisible: false,
    activityBarVisible: false,
    updatedAt: 0,
  };
}

function pane(id: string, tabGroupId: string) {
  return {
    id,
    type: 'pane' as const,
    tabGroupId,
    minWidth: 260,
    minHeight: 180,
  };
}
