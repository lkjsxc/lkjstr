import { describe, expect, it } from 'vitest';
import {
  convertWorkspaceTab,
  createWorkspace,
  openNewTabChooser,
} from '../../../src/lib/workspace/workspace';

describe('new tab chooser workspace command', () => {
  it('opens a focused New Tab in the requested pane', () => {
    const workspace = createWorkspace();
    const opened = openNewTabChooser(workspace, workspace.focusedPaneId!);
    const tab = opened.tabs[opened.focusedTabId!];
    expect(tab?.kind).toBe('new-tab');
    expect(tab?.title).toBe('New Tab');
  });

  it('converts without changing the tab id', () => {
    const workspace = createWorkspace();
    const opened = openNewTabChooser(workspace, workspace.focusedPaneId!);
    const tabId = opened.focusedTabId!;
    const converted = convertWorkspaceTab(opened, tabId, 'profile', {
      pubkey: 'a'.repeat(64),
    });
    expect(converted.tabs[tabId]).toMatchObject({
      id: tabId,
      kind: 'profile',
      title: 'Profile',
    });
  });
});
