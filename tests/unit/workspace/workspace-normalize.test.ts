import { describe, expect, it } from 'vitest';
import { normalizeWorkspace } from '../../../src/lib/workspace/workspace-normalize';

describe('workspace normalization', () => {
  it('drops stale cache status tabs and recovers the workspace', () => {
    const workspace = normalizeWorkspace({
      layout: {
        id: 'pane-a',
        type: 'pane',
        tabGroupId: 'group-a',
        minWidth: 260,
        minHeight: 180,
      },
      tabGroups: {
        'group-a': {
          id: 'group-a',
          tabIds: ['tab-a'],
          activeTabId: 'tab-a',
          pinnedTabIds: [],
          closedTabs: [],
        },
      },
      tabs: {
        'tab-a': {
          id: 'tab-a',
          kind: 'cache-status',
          title: 'Cache',
          icon: 'database',
          config: {},
          state: {},
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    expect(Object.values(workspace.tabs).map((tab) => tab.kind)).toEqual([
      'welcome',
    ]);
    expect(workspace.focusedTabId).toBeTruthy();
  });

  it('keeps custom request and author context tabs', () => {
    const workspace = normalizeWorkspace({
      layout: {
        id: 'pane-a',
        type: 'pane',
        tabGroupId: 'group-a',
        minWidth: 260,
        minHeight: 180,
      },
      tabGroups: {
        'group-a': {
          id: 'group-a',
          tabIds: ['custom', 'author'],
          activeTabId: 'custom',
          pinnedTabIds: [],
          closedTabs: [],
        },
      },
      tabs: {
        custom: tab('custom-request'),
        author: tab('author-context'),
      },
    });
    expect(workspace.tabs.custom?.kind).toBe('custom-request');
    expect(workspace.tabs.author?.kind).toBe('author-context');
  });

  it('caps and normalizes closed tabs', () => {
    const closedTabs = Array.from({ length: 25 }, () => tab('timeline'));
    const workspace = normalizeWorkspace({
      layout: {
        id: 'pane-a',
        type: 'pane',
        tabGroupId: 'group-a',
        minWidth: 260,
        minHeight: 180,
      },
      tabGroups: {
        'group-a': {
          id: 'group-a',
          tabIds: ['active'],
          activeTabId: 'active',
          pinnedTabIds: [],
          closedTabs,
        },
      },
      tabs: { active: tab('timeline') },
    });
    const group = workspace.tabGroups['group-a'];
    expect(group.closedTabs).toHaveLength(20);
    expect(group.closedTabs.every((item) => item.kind === 'timeline')).toBe(
      true,
    );
  });
});

function tab(kind: string) {
  return {
    id: kind,
    kind,
    title: kind,
    icon: '',
    config: {},
    state: {},
    createdAt: 1,
    updatedAt: 1,
  };
}
