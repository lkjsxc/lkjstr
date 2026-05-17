import type { WorkspaceTab } from './tab';

export type TabGroup = {
  readonly id: string;
  readonly tabIds: readonly string[];
  readonly activeTabId: string;
  readonly pinnedTabIds: readonly string[];
  readonly closedTabs: readonly WorkspaceTab[];
};

export function createTabGroup(tab: WorkspaceTab): TabGroup {
  return {
    id: crypto.randomUUID(),
    tabIds: [tab.id],
    activeTabId: tab.id,
    pinnedTabIds: [],
    closedTabs: [],
  };
}

export function addTab(group: TabGroup, tabId: string): TabGroup {
  if (group.tabIds.includes(tabId)) return activateTab(group, tabId);
  return { ...group, tabIds: [...group.tabIds, tabId], activeTabId: tabId };
}

export function activateTab(group: TabGroup, tabId: string): TabGroup {
  if (!group.tabIds.includes(tabId)) return group;
  return { ...group, activeTabId: tabId };
}

export function closeTab(group: TabGroup, tab: WorkspaceTab): TabGroup {
  const tabIds = group.tabIds.filter((id) => id !== tab.id);
  const activeTabId =
    group.activeTabId === tab.id ? (tabIds.at(-1) ?? '') : group.activeTabId;
  return {
    ...group,
    tabIds,
    activeTabId,
    pinnedTabIds: group.pinnedTabIds.filter((id) => id !== tab.id),
    closedTabs: [tab, ...group.closedTabs].slice(0, 20),
  };
}

export function moveTabWithinGroup(
  group: TabGroup,
  tabId: string,
  toIndex: number,
): TabGroup {
  const tabIds = group.tabIds.filter((id) => id !== tabId);
  if (tabIds.length === group.tabIds.length) return group;
  const nextIndex = Math.max(0, Math.min(toIndex, tabIds.length));
  tabIds.splice(nextIndex, 0, tabId);
  return { ...group, tabIds };
}
