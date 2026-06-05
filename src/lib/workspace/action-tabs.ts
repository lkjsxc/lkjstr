import { findPane } from './layout-tree';
import { focusTab, openTab, type Workspace } from './workspace';

type MatchingKind = 'profile' | 'thread' | 'followees' | 'user-timeline';
type ActionKind = MatchingKind | 'profile-edit' | 'author-context';

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

export function openFolloweesTab(
  workspace: Workspace,
  paneId: string,
  pubkey: string,
): Workspace {
  return openMatchingTab(workspace, paneId, 'followees', 'pubkey', pubkey);
}

export function openUserTimelineTab(
  workspace: Workspace,
  paneId: string,
  pubkey: string,
): Workspace {
  return openMatchingTab(workspace, paneId, 'user-timeline', 'pubkey', pubkey);
}

export function openAuthorContextTab(
  workspace: Workspace,
  paneId: string,
  eventId: string,
  pubkey: string,
): Workspace {
  const existing = matchingTabId(
    workspace,
    paneId,
    'author-context',
    'eventId',
    eventId,
  );
  if (existing) return focusTab(workspace, paneId, existing);
  return openTab(workspace, paneId, 'author-context', 'Author Context', {
    eventId,
    pubkey,
  });
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
  kind: MatchingKind,
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
  kind: ActionKind,
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

function title(kind: MatchingKind): string {
  if (kind === 'profile') return 'Profile';
  if (kind === 'thread') return 'Thread';
  return kind === 'followees' ? 'Following' : 'User Timeline';
}
