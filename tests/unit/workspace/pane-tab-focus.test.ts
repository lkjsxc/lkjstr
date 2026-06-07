import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaneScrollRetention } from '../../../src/lib/workspace/pane-scroll-retention';
import { createSessionTabSnapshots } from '../../../src/lib/workspace/session-tab-snapshots';
import { syncPaneTabFocus } from '../../../src/lib/workspace/pane-tab-focus';
import { createTab } from '../../../src/lib/workspace/tab';
import type { TabSnapshotPayload } from '../../../src/lib/workspace/tab-snapshot';

function fakeScrollOwner(scrollTop: number): HTMLElement {
  return {
    scrollTop,
    scrollHeight: 400,
    clientHeight: 100,
    hasAttribute: (name: string) => name === 'data-scroll-owner',
    classList: { contains: () => false },
  } as unknown as HTMLElement;
}

function fakePaneBody(owner: HTMLElement): HTMLElement {
  return fakePaneBodyWithOwners([owner]);
}

function fakePaneBodyWithOwners(owners: readonly HTMLElement[]): HTMLElement {
  return {
    className: 'pane-body',
    innerHTML: '',
    querySelector: () => owners[0],
    querySelectorAll: (selector: string) =>
      selector === '[data-scroll-owner]' ? owners : [],
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as HTMLElement;
}

describe('syncPaneTabFocus', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  it('requires exactly one explicit scroll owner', () => {
    const bodyScroll = createPaneScrollRetention();
    const owner = fakeScrollOwner(240);
    const none = fakePaneBodyWithOwners([]);
    const many = fakePaneBodyWithOwners([owner, fakeScrollOwner(12)]);

    bodyScroll.track('none', none);
    bodyScroll.track('many', many);
    bodyScroll.remember('none');
    bodyScroll.remember('many');

    expect(bodyScroll.snapshot('none').scrollTop).toBeUndefined();
    expect(bodyScroll.snapshot('many').scrollTop).toBeUndefined();
  });

  it('skips scroll restore when the tab body stayed mounted', async () => {
    const bodyScroll = createPaneScrollRetention();
    const snapshots = createSessionTabSnapshots<
      TabSnapshotPayload & { readonly id: string }
    >();
    const owner = fakeScrollOwner(240);
    const paneBody = fakePaneBody(owner);
    const settings = createTab('settings', 'Settings');
    bodyScroll.track(settings.id, paneBody);
    bodyScroll.remember(settings.id);
    snapshots.retain({ id: settings.id, kind: 'tool', scrollTop: 12 }, 60);
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
