<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { onDestroy } from 'svelte';
  import type { WorkspacePaneNode } from '$lib/workspace/pane';
  import { createPaneScrollRetention } from '$lib/workspace/pane-scroll-retention';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import { createSessionTabSnapshots } from '$lib/workspace/session-tab-snapshots';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';
  import { syncPaneTabFocus } from '$lib/workspace/pane-tab-focus';
  import NewTabButton from './NewTabButton.svelte';
  import PaneDropLayer from './PaneDropLayer.svelte';
  import PaneTabStack from './PaneTabStack.svelte';
  import TabStrip from './TabStrip.svelte';
  import TileMenu from './TileMenu.svelte';

  type Props = {
    workspaceId: string;
    pane: WorkspacePaneNode;
    group?: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    accounts: Account[];
    activeAccount?: Account;
    relaySets: RelaySet[];
    ready: boolean;
    pageDataReady: boolean;
    inactiveRetentionSeconds: number;
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    moveTab: (
      sourcePaneId: string,
      targetPaneId: string,
      tabId: string,
      targetIndex: number,
      edge?: 'left' | 'right' | 'top' | 'bottom',
    ) => void;
    openNewTab: (paneId: string) => void;
    convertTab: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    closePane: (paneId: string) => void;
    addMinedSigning: (nsec: string) => Promise<void>;
    refreshData: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
    openProfile: (paneId: string, pubkey: string) => void;
    openProfileEdit: (paneId: string) => void;
    openThread: (paneId: string, eventId: string) => void;
    openAuthorContext: (
      paneId: string,
      eventId: string,
      pubkey: string,
    ) => void;
    openTool: (paneId: string, kind: TabKind) => void;
  };

  let props: Props = $props();
  type TabSnapshot = TabSnapshotPayload & { readonly id: string };
  let restorePayload = $state<TabSnapshotPayload | undefined>();
  let active = $derived(
    props.group?.activeTabId ? props.tabs[props.group.activeTabId] : undefined,
  );
  let previousActiveId = $state<string | undefined>();
  let previousRetentionSeconds = $state<number | undefined>();
  const bodyScroll = createPaneScrollRetention();
  const snapshots = createSessionTabSnapshots<TabSnapshot>();

  $effect.pre(() => {
    const activeId = active?.id;
    if (previousActiveId && previousActiveId !== activeId)
      bodyScroll.remember(previousActiveId);
  });

  $effect(() => {
    const activeId = active?.id;
    void syncPaneTabFocus({
      workspaceId: props.workspaceId,
      paneId: props.pane.id,
      active,
      previousActiveId,
      tabs: props.tabs,
      group: props.group,
      inactiveRetentionSeconds: props.inactiveRetentionSeconds,
      bodyScroll,
      snapshots,
    }).then((next: { restorePayload?: TabSnapshotPayload }) => {
      restorePayload = next.restorePayload;
    });
    previousActiveId = activeId;
  });

  $effect(() => {
    if (previousRetentionSeconds !== props.inactiveRetentionSeconds) {
      snapshots.releaseAll('retention-disabled');
      previousRetentionSeconds = props.inactiveRetentionSeconds;
    }
    if (props.inactiveRetentionSeconds > 0) return;
    snapshots.releaseAll('retention-disabled');
  });

  $effect(() => {
    snapshots.releaseMissing(new Set(props.group?.tabIds ?? []));
  });

  function trackBody(node: HTMLElement, tabId: string) {
    return bodyScroll.track(tabId, node);
  }

  onDestroy(() => snapshots.releaseAll('pane-destroyed'));
</script>

<section
  class="pane"
  data-pane-id={props.pane.id}
  data-tab-count={props.group?.tabIds.length ?? 0}
  aria-label="Workspace pane"
>
  <PaneDropLayer
    paneId={props.pane.id}
    disabled={!props.ready}
    moveTab={props.moveTab}
  />
  <header class="pane-head">
    <div class="pane-actions">
      <TileMenu
        split={(direction) => props.split(props.pane.id, direction)}
        closePane={() => props.closePane(props.pane.id)}
        disabled={!props.ready}
      />
      <NewTabButton
        open={() => props.openNewTab(props.pane.id)}
        disabled={!props.ready}
      />
    </div>
    {#if props.group}
      <TabStrip
        group={props.group}
        paneId={props.pane.id}
        tabs={props.tabs}
        focusTab={(tabId) => props.focusTab(props.pane.id, tabId)}
        closeTab={(tabId) => props.closeTab(props.pane.id, tabId)}
        moveTab={props.moveTab}
        disabled={!props.ready}
      />
    {/if}
  </header>

  <div class="pane-stack">
    {#if props.group}
      <PaneTabStack
        group={props.group}
        tabs={props.tabs}
        paneId={props.pane.id}
        {restorePayload}
        accounts={props.accounts}
        activeAccount={props.activeAccount}
        relaySets={props.relaySets}
        pageDataReady={props.pageDataReady}
        trackBody={trackBody}
        convertTab={props.convertTab}
        addMinedSigning={props.addMinedSigning}
        refreshData={props.refreshData}
        toggleRelay={props.toggleRelay}
        removeRelay={props.removeRelay}
        openProfile={props.openProfile}
        openProfileEdit={props.openProfileEdit}
        openThread={props.openThread}
        openAuthorContext={props.openAuthorContext}
        openTool={props.openTool}
      />
    {/if}
  </div>
</section>
