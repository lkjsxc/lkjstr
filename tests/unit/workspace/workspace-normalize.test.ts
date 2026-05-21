import { describe, expect, it } from 'vitest';
import { normalizeWorkspace } from '../../../src/lib/workspace/workspace-normalize';

describe('workspace normalization', () => {
  it('migrates legacy cache status tabs to stats tabs', () => {
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
    expect(workspace.tabs['tab-a']?.kind).toBe('network-stats');
    expect(workspace.tabs['tab-a']?.title).toBe('Stats');
  });
});
