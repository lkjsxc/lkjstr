import { describe, expect, it } from 'vitest';
import { createPaneScrollRetention } from '../../../src/lib/workspace/pane-scroll-retention';
import { createSessionTabSnapshots } from '../../../src/lib/workspace/session-tab-snapshots';
import { syncPaneTabFocus } from '../../../src/lib/workspace/pane-tab-focus';
import { createTab } from '../../../src/lib/workspace/tab';
import type { TabSnapshotPayload } from '../../../src/lib/workspace/tab-snapshot';

describe('syncPaneTabFocus', () => {
  it('skips scroll restore when the tab body stayed mounted', async () => {
    const bodyScroll = createPaneScrollRetention();
    const snapshots = createSessionTabSnapshots<
      TabSnapshotPayload & { readonly id: string }
    >();
    const paneBody = document.createElement('div');
    paneBody.className = 'pane-body';
    paneBody.innerHTML =
      '<div class="settings-tab" data-scroll-owner style="height:100px;overflow:auto"><div style="height:400px"></div></div>';
    const owner = paneBody.querySelector<HTMLElement>('.settings-tab')!;
    owner.scrollTop = 240;
    bodyScroll.track('settings', paneBody);
    bodyScroll.remember('settings');
    snapshots.retain({ id: 'settings', kind: 'tool', scrollTop: 12 }, 60);

    const settings = createTab('settings', 'Settings');
    const tabs = { settings };

    await syncPaneTabFocus({
      workspaceId: 'ws',
      paneId: 'pane',
      active: settings,
      previousActiveId: 'home',
      tabs,
      group: {
        id: 'group',
        tabIds: ['home', 'settings'],
        activeTabId: 'settings',
        pinnedTabIds: [],
        closedTabs: [],
      },
      inactiveRetentionSeconds: 60,
      bodyScroll,
      snapshots,
    });

    expect(owner.scrollTop).toBe(240);
    expect(snapshots.records()).toEqual([]);
  });
});
