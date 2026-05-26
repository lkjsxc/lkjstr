import { describe, expect, it } from 'vitest';
import { createPaneScrollRetention } from '../../../src/lib/workspace/pane-scroll-retention';
import { createSessionTabSnapshots } from '../../../src/lib/workspace/session-tab-snapshots';
import { syncPaneTabFocus } from '../../../src/lib/workspace/pane-tab-focus';
import type { WorkspaceTab } from '../../../src/lib/workspace/tab';

describe('syncPaneTabFocus', () => {
  it('skips scroll restore when the tab body stayed mounted', async () => {
    const bodyScroll = createPaneScrollRetention();
    const snapshots = createSessionTabSnapshots<{
      id: string;
      kind: 'tool';
      scrollTop: number;
    }>();
    const paneBody = document.createElement('div');
    paneBody.className = 'pane-body';
    paneBody.innerHTML =
      '<div class="settings-tab" data-scroll-owner style="height:100px;overflow:auto"><div style="height:400px"></div></div>';
    const owner = paneBody.querySelector<HTMLElement>('.settings-tab')!;
    owner.scrollTop = 240;
    bodyScroll.track('settings', paneBody);
    snapshots.retain({ id: 'settings', kind: 'tool', scrollTop: 12 }, 60);

    const tabs: Record<string, WorkspaceTab> = {
      settings: {
        id: 'settings',
        title: 'Settings',
        kind: 'settings',
        config: {},
      },
    };

    await syncPaneTabFocus({
      workspaceId: 'ws',
      paneId: 'pane',
      active: tabs.settings,
      previousActiveId: 'home',
      tabs,
      group: { paneId: 'pane', tabIds: ['home', 'settings'], activeTabId: 'settings' },
      inactiveRetentionSeconds: 60,
      bodyScroll,
      snapshots,
    });

    expect(owner.scrollTop).toBe(240);
    expect(snapshots.records()).toEqual([]);
  });
});
