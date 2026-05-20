import { describe, expect, it } from 'vitest';
import { closeWorkspacePane } from '../../../src/lib/workspace/pane-commands';
import {
  closeWorkspaceTab,
  createWorkspace,
  openTab,
  splitFocusedPane,
} from '../../../src/lib/workspace/workspace';

describe('last-tab tile close', () => {
  it('closing a non-final tab keeps the tile', () => {
    const workspace = createWorkspace();
    const opened = openTab(
      workspace,
      workspace.focusedPaneId,
      'settings',
      'Settings',
    );
    const closed = closeWorkspaceTab(
      opened,
      opened.focusedPaneId!,
      opened.focusedTabId!,
    );
    expect(closed.layout?.type).toBe('pane');
    expect(Object.keys(closed.tabs)).toHaveLength(1);
    expect(Object.values(closed.tabGroups)[0]?.tabIds).toHaveLength(1);
  });

  it('closing the final tab in one tile removes only that tile', () => {
    const workspace = splitFocusedPane(createWorkspace(), 'horizontal');
    const closed = closeWorkspaceTab(
      workspace,
      workspace.focusedPaneId!,
      workspace.focusedTabId!,
    );
    expect(closed.layout?.type).toBe('pane');
    expect(Object.keys(closed.tabs)).toHaveLength(1);
    expect(closed.focusedPaneId).toBe(closed.layout?.id);
  });

  it('closing the final tab in the final tile recovers a Welcome tile', () => {
    const workspace = createWorkspace();
    const closed = closeWorkspaceTab(
      workspace,
      workspace.focusedPaneId!,
      workspace.focusedTabId!,
    );
    expect(closed.layout?.type).toBe('pane');
    expect(Object.values(closed.tabs)[0]?.kind).toBe('welcome');
  });

  it('closing a tile removes all tabs in that tile', () => {
    const workspace = openTab(createWorkspace(), null, 'settings', 'Settings');
    const closed = closeWorkspacePane(workspace, workspace.focusedPaneId!);
    expect(closed.layout?.type).toBe('pane');
    expect(Object.keys(closed.tabs)).toHaveLength(1);
    expect(Object.values(closed.tabs)[0]?.kind).toBe('welcome');
  });
});
