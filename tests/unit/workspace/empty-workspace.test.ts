import { describe, expect, it } from 'vitest';
import {
  createEmptyWorkspace,
  ensureWorkspaceHasPane,
  openFirstPaneTab,
} from '../../../src/lib/workspace/workspace';
import { closeWorkspacePane } from '../../../src/lib/workspace/pane-commands';

describe('empty workspace', () => {
  it('creates a valid zero-pane workspace', () => {
    const workspace = createEmptyWorkspace();
    expect(workspace.layout).toBeNull();
    expect(workspace.focusedPaneId).toBeNull();
    expect(Object.keys(workspace.tabs)).toHaveLength(0);
  });

  it('creates one empty pane from a zero-pane workspace', () => {
    const workspace = ensureWorkspaceHasPane(createEmptyWorkspace());
    expect(workspace.layout?.type).toBe('pane');
    expect(Object.keys(workspace.tabGroups)).toHaveLength(1);
    expect(Object.keys(workspace.tabs)).toHaveLength(0);
  });

  it('opens a first tab from an empty workspace', () => {
    const workspace = openFirstPaneTab(createEmptyWorkspace(), 'settings');
    expect(workspace.layout?.type).toBe('pane');
    expect(Object.values(workspace.tabs)[0]?.kind).toBe('settings');
  });

  it('closing the final pane returns to empty workspace', () => {
    const workspace = ensureWorkspaceHasPane(createEmptyWorkspace());
    if (!workspace.focusedPaneId) throw new Error('expected pane');
    const closed = closeWorkspacePane(workspace, workspace.focusedPaneId);
    expect(closed.layout).toBeNull();
    expect(closed.focusedPaneId).toBeNull();
  });
});
