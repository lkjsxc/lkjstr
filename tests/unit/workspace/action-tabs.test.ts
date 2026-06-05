import { describe, expect, it } from 'vitest';
import { paneIds } from '../../../src/lib/workspace/layout-tree';
import {
  openFolloweesTab,
  openProfileTab,
  openThreadTab,
  openUserTimelineTab,
} from '../../../src/lib/workspace/action-tabs';
import {
  createWorkspace,
  openNewTabChooser,
} from '../../../src/lib/workspace/workspace';
import { createWorkspacePageActions } from '../../../src/lib/workspace/workspace-page-actions';

describe('workspace action tabs', () => {
  it('focuses an existing matching profile tab in the same pane', () => {
    const workspace = createWorkspace();
    const paneId = paneIds(workspace.layout!)[0]!;
    const opened = openProfileTab(workspace, paneId, 'a'.repeat(64));
    const reused = openProfileTab(opened, paneId, 'a'.repeat(64));

    expect(
      Object.values(reused.tabs).filter((tab) => tab.kind === 'profile'),
    ).toHaveLength(1);
    expect(reused.focusedTabId).toBe(opened.focusedTabId);
  });

  it('focuses an existing matching thread tab in the same pane', () => {
    const workspace = createWorkspace();
    const paneId = paneIds(workspace.layout!)[0]!;
    const opened = openThreadTab(workspace, paneId, 'b'.repeat(64));
    const reused = openThreadTab(opened, paneId, 'b'.repeat(64));

    expect(
      Object.values(reused.tabs).filter((tab) => tab.kind === 'thread'),
    ).toHaveLength(1);
    expect(reused.focusedTabId).toBe(opened.focusedTabId);
  });

  it('focuses matching Followees and User Timeline tabs', () => {
    const workspace = createWorkspace();
    const paneId = paneIds(workspace.layout!)[0]!;
    const pubkey = 'c'.repeat(64);
    const followees = openFolloweesTab(workspace, paneId, pubkey);
    const timeline = openUserTimelineTab(followees, paneId, pubkey);
    const reused = openUserTimelineTab(timeline, paneId, pubkey);

    expect(
      Object.values(reused.tabs).filter((tab) => tab.kind === 'followees'),
    ).toHaveLength(1);
    expect(
      Object.values(reused.tabs).filter((tab) => tab.kind === 'user-timeline'),
    ).toHaveLength(1);
    expect(reused.focusedTabId).toBe(timeline.focusedTabId);
  });

  it('converts fixed timeline choices by focusing an existing same-pane tab', async () => {
    let workspace = createWorkspace();
    const paneId = paneIds(workspace.layout!)[0]!;
    const pubkey = 'd'.repeat(64);
    workspace = openUserTimelineTab(workspace, paneId, pubkey);
    workspace = openNewTabChooser(workspace, paneId);
    const chooserId = workspace.focusedTabId!;
    const actions = createWorkspacePageActions({
      getWorkspace: () => workspace,
      update: async (next) => {
        workspace = next;
      },
      captureAllTabs: () => undefined,
      snapshotCoordinator: () =>
        ({
          captureTab: async () => undefined,
          deleteTab: async () => undefined,
        }) as never,
      refreshData: async () => undefined,
      setRelaySets: () => undefined,
    });

    await actions.convertTab(chooserId, 'user-timeline', { pubkey });

    expect(
      Object.values(workspace.tabs).filter((tab) => tab.kind === 'new-tab'),
    ).toHaveLength(0);
    expect(
      Object.values(workspace.tabs).filter(
        (tab) => tab.kind === 'user-timeline',
      ),
    ).toHaveLength(1);
  });
});
