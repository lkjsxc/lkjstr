import type { Workspace } from './workspace';

export const bootstrapWorkspaceId = 'main';

export function bootstrapWorkspace(): Workspace {
  const tabId = 'bootstrap-home-tab';
  const groupId = 'bootstrap-home-group';
  const paneId = 'bootstrap-home-pane';
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
        kind: 'timeline',
        title: 'Home',
        icon: 'list',
        config: { variant: 'home' },
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
