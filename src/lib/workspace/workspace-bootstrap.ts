import type { Workspace } from './workspace';

export const bootstrapWorkspaceId = 'main';

export function bootstrapWorkspace(): Workspace {
  const tabId = 'bootstrap-welcome-tab';
  const groupId = 'bootstrap-welcome-group';
  const paneId = 'bootstrap-welcome-pane';
  return {
    id: bootstrapWorkspaceId,
    name: 'Main workspace',
    layout: {
      id: paneId,
      type: 'pane',
      tabGroupId: groupId,
      minWidth: 260,
      minHeight: 180,
    },
    tabGroups: {
      [groupId]: {
        id: groupId,
        tabIds: [tabId],
        activeTabId: tabId,
        pinnedTabIds: [],
        closedTabs: [],
      },
    },
    tabs: {
      [tabId]: {
        id: tabId,
        kind: 'welcome',
        title: 'Welcome',
        icon: 'star',
        config: {},
        state: {},
        createdAt: 0,
        updatedAt: 0,
      },
    },
    focusedPaneId: paneId,
    focusedTabId: tabId,
    activeAccountId: null,
    sidebarVisible: false,
    activityBarVisible: false,
    updatedAt: 0,
  };
}
