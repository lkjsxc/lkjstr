import { findPane } from './layout-tree';
import { focusTab, openTab, type Workspace } from './workspace';

export function openProfileTab(
  workspace: Workspace,
  paneId: string,
  pubkey: string,
): Workspace {
  return openMatchingTab(workspace, paneId, 'profile', 'pubkey', pubkey);
}

export function openThreadTab(
  workspace: Workspace,
  paneId: string,
  eventId: string,
): Workspace {
  return openMatchingTab(workspace, paneId, 'thread', 'eventId', eventId);
}

export function openProfileEditTab(
  workspace: Workspace,
  paneId: string,
): Workspace {
  const existing = matchingTabId(workspace, paneId, 'profile-edit');
  if (existing) return focusTab(workspace, paneId, existing);
  return openTab(workspace, paneId, 'profile-edit', 'Profile Edit');
}

function openMatchingTab(
  workspace: Workspace,
  paneId: string,
  kind: 'profile' | 'thread',
  key: 'pubkey' | 'eventId',
  value: string,
): Workspace {
  const existing = matchingTabId(workspace, paneId, kind, key, value);
  if (existing) return focusTab(workspace, paneId, existing);
  return openTab(workspace, paneId, kind, title(kind), { [key]: value });
}

function matchingTabId(
  workspace: Workspace,
  paneId: string,
  kind: 'profile' | 'profile-edit' | 'thread',
  key?: 'pubkey' | 'eventId',
  value?: string,
): string | undefined {
  if (!workspace.layout) return undefined;
  const pane = findPane(workspace.layout, paneId);
  const group = pane ? workspace.tabGroups[pane.tabGroupId] : undefined;
  return group?.tabIds.find((id) => {
    const tab = workspace.tabs[id];
    return tab?.kind === kind && (!key || tab.config[key] === value);
  });
}

function title(kind: 'profile' | 'thread'): string {
  return kind === 'profile' ? 'Profile' : 'Thread';
}
