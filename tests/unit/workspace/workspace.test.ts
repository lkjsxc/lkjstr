import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createPane } from '../../../src/lib/workspace/pane';
import { parseLayout, splitPane } from '../../../src/lib/workspace/layout-tree';
import { resizeHere } from '../../../src/lib/workspace/resize';
import {
  closeWorkspaceTab,
  createWorkspace,
  openTab,
  splitFocusedPane,
} from '../../../src/lib/workspace/workspace';
import { bootstrapWorkspace } from '../../../src/lib/workspace/workspace-bootstrap';
import { createDefaultTabRegistry } from '../../../src/lib/workspace/tab-registry';

describe('workspace model', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('creates and serializes a restorable workspace', () => {
    const workspace = createWorkspace();
    const raw = JSON.parse(JSON.stringify(workspace.layout)) as unknown;
    expect(parseLayout(raw)).toEqual(workspace.layout);
    expect(parseLayout({ type: 'split', children: [] })).toBeUndefined();
  });

  it('boots into welcome plus main startup tabs', () => {
    const workspace = bootstrapWorkspace();
    expect(workspace.layout?.type).toBe('split');
    if (workspace.layout?.type !== 'split') throw new Error('expected split');
    expect(workspace.layout.direction).toBe('vertical');
    expect(workspace.layout.sizes).toEqual([0.4, 0.6]);
    const right = workspace.layout.children[1];
    if (right.type !== 'pane') throw new Error('expected right pane');
    const group = workspace.tabGroups[right.tabGroupId];
    expect(group.tabIds.map((id) => workspace.tabs[id]?.title)).toEqual([
      'Accounts',
      'Relay Settings',
      'Home',
      'Notifications',
      'Tweet',
    ]);
    expect(workspace.tabs[group.activeTabId!]?.title).toBe('Accounts');
    expect(workspace.tabs[workspace.focusedTabId!]?.title).toBe('Welcome');
  });

  it('supports horizontal and vertical nested splits', () => {
    const workspace = createWorkspace();
    const firstPane = workspace.focusedPaneId;
    const horizontal = splitFocusedPane(workspace, 'horizontal');
    const vertical = splitFocusedPane(horizontal, 'vertical');
    if (!vertical.layout) throw new Error('expected layout');
    expect(vertical.layout.type).toBe('split');
    expect(JSON.stringify(vertical.layout)).toContain(firstPane);
    expect(JSON.stringify(vertical.layout)).toContain('vertical');
  });

  it('opens and closes tabs inside a pane group', () => {
    const workspace = createWorkspace();
    const opened = openTab(
      workspace,
      workspace.focusedPaneId,
      'notifications',
      'Notifications',
    );
    expect(Object.keys(opened.tabs)).toHaveLength(2);
    if (!opened.focusedPaneId || !opened.focusedTabId)
      throw new Error('expected focused tab');
    const closed = closeWorkspaceTab(
      opened,
      opened.focusedPaneId,
      opened.focusedTabId,
    );
    expect(Object.keys(closed.tabs)).toHaveLength(1);
  });

  it('resizes split ratios without changing child identity', () => {
    const pane = createPane('group-a');
    const split = splitPane(pane, pane.id, 'horizontal', createPane('group-b'));
    if (split.type !== 'split') throw new Error('expected split');
    const resized = resizeHere(split, 0, 0.2);
    expect(resized.children).toBe(split.children);
    expect(Math.round(resized.sizes.reduce((a, b) => a + b) * 100)).toBe(100);
  });

  it('creates default runtimes with idempotent cleanup', () => {
    const runtime = createDefaultTabRegistry()
      .require('tweet')
      .createRuntime({ tabId: 'tab-a', config: {} });
    runtime.suspend();
    runtime.resume();
    runtime.close();
    runtime.close();
    expect(runtime.metadata().title).toBe('Tweet');
  });
});
