import { describe, expect, it } from 'vitest';
import { paneIds } from '../../../src/lib/workspace/layout-tree';
import {
  openFolloweesTab,
  openProfileTab,
  openThreadTab,
  openUserTimelineTab,
} from '../../../src/lib/workspace/action-tabs';
import { createWorkspace } from '../../../src/lib/workspace/workspace';

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
});
