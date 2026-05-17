import { describe, expect, it } from 'vitest';
import {
  closeWorkspaceTab,
  createWorkspace,
  openTab,
} from '../../../src/lib/workspace/workspace';

describe('zero-tab workspace', () => {
  it('closing the final tab leaves one empty pane', () => {
    const workspace = createWorkspace();
    if (!workspace.focusedPaneId || !workspace.focusedTabId)
      throw new Error('expected tab');
    const closed = closeWorkspaceTab(
      workspace,
      workspace.focusedPaneId,
      workspace.focusedTabId,
    );
    expect(closed.layout?.type).toBe('pane');
    expect(Object.keys(closed.tabs)).toHaveLength(0);
    expect(Object.values(closed.tabGroups)[0]?.activeTabId).toBeNull();
  });

  it('opens a tab from an empty pane', () => {
    const workspace = createWorkspace();
    if (!workspace.focusedPaneId || !workspace.focusedTabId)
      throw new Error('expected tab');
    const closed = closeWorkspaceTab(
      workspace,
      workspace.focusedPaneId,
      workspace.focusedTabId,
    );
    const opened = openTab(
      closed,
      closed.focusedPaneId,
      'settings',
      'Settings',
    );
    expect(Object.values(opened.tabs)[0]?.kind).toBe('settings');
  });
});
