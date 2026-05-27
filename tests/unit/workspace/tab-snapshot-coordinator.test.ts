import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTab } from '../../../src/lib/workspace/tab';
import { createTabSnapshotCoordinator } from '../../../src/lib/workspace/tab-snapshot-coordinator';
import { tabStateId } from '../../../src/lib/workspace/tab-states-store';

type Stored = {
  readonly workspaceId: string;
  readonly lastPaneId?: string;
  readonly tabId: string;
  readonly state: unknown;
};

const { rows } = vi.hoisted(() => ({
  rows: new Map<string, Stored>(),
}));

vi.mock('../../../src/lib/workspace/tab-states-store', () => ({
  tabStateId: (workspaceId: string, tabId: string) => `${workspaceId}:${tabId}`,
  saveTabState: vi.fn(
    async (
      workspaceId: string,
      lastPaneId: string | undefined,
      tabId: string,
      state: unknown,
    ) => {
      rows.set(`${workspaceId}:${tabId}`, {
        workspaceId,
        lastPaneId,
        tabId,
        state,
      });
    },
  ),
  loadTabState: vi.fn(async (workspaceId: string, tabId: string) => {
    return rows.get(`${workspaceId}:${tabId}`)?.state;
  }),
  deleteTabState: vi.fn(async (workspaceId: string, tabId: string) => {
    rows.delete(`${workspaceId}:${tabId}`);
  }),
  deleteMissingTabStates: vi.fn(
    async (workspaceId: string, tabIds: ReadonlySet<string>) => {
      for (const row of [...rows.values()])
        if (row.workspaceId === workspaceId && !tabIds.has(row.tabId))
          rows.delete(`${workspaceId}:${row.tabId}`);
    },
  ),
}));

describe('tab snapshot coordinator', () => {
  beforeEach(() => rows.clear());

  it('keys durable snapshots by workspace and tab across pane movement', async () => {
    const tab = createTab('settings', 'Settings');
    const coordinator = createTabSnapshotCoordinator({
      workspaceId: 'ws',
      inactiveRetentionSeconds: 0,
    });

    await coordinator.captureTab('pane-a', tab);
    await coordinator.captureTab('pane-b', tab);

    expect(tabStateId('ws', tab.id)).toBe(`ws:${tab.id}`);
    expect([...rows.keys()]).toEqual([`ws:${tab.id}`]);
    expect(rows.get(`ws:${tab.id}`)?.lastPaneId).toBe('pane-b');
  });

  it('delivers restore payloads once and ignores stale tokens', async () => {
    const tab = createTab('settings', 'Settings');
    const coordinator = createTabSnapshotCoordinator({
      workspaceId: 'ws',
      inactiveRetentionSeconds: 0,
    });
    await coordinator.captureTab('pane', tab);
    await coordinator.loadTabs([tab.id]);
    const restore = coordinator.restoreRecords()[tab.id];

    coordinator.consumeRestore(tab.id, restore);
    expect(coordinator.restoreRecords()[tab.id]).toBeUndefined();

    await coordinator.loadTabs([tab.id]);
    const stale = { ...coordinator.restoreRecords()[tab.id], token: 'stale' };
    coordinator.consumeRestore(tab.id, stale);
    expect(coordinator.restoreRecords()[tab.id]).toBeDefined();
  });

  it('deletes only absent tab snapshots during cleanup', async () => {
    const keep = createTab('settings', 'Settings');
    const remove = createTab('search', 'Search');
    const coordinator = createTabSnapshotCoordinator({
      workspaceId: 'ws',
      inactiveRetentionSeconds: 0,
    });

    await coordinator.captureTab('pane', keep);
    await coordinator.captureTab('pane', remove);
    await coordinator.cleanup(new Set([keep.id]));

    expect(rows.has(`ws:${keep.id}`)).toBe(true);
    expect(rows.has(`ws:${remove.id}`)).toBe(false);
  });

  it('removes durable state by tab id on explicit close', async () => {
    const tab = createTab('settings', 'Settings');
    const coordinator = createTabSnapshotCoordinator({
      workspaceId: 'ws',
      inactiveRetentionSeconds: 0,
    });

    await coordinator.captureTab('pane-a', tab);
    await coordinator.deleteTab(tab.id);

    expect(rows.has(`ws:${tab.id}`)).toBe(false);
  });
});
