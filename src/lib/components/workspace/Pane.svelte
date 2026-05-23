<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { RelaySnapshot } from '$lib/relays/types';
  import { onDestroy } from 'svelte';
  import type { WorkspacePaneNode } from '$lib/workspace/pane';
  import { PaneScrollRetention } from '$lib/workspace/pane-scroll-retention';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import { TabRetention } from '$lib/workspace/tab-retention';
  import NewTabButton from './NewTabButton.svelte';
  import PaneDropLayer from './PaneDropLayer.svelte';
  import PaneTabBody from './PaneTabBody.svelte';
  import TabStrip from './TabStrip.svelte';
  import TileMenu from './TileMenu.svelte';

  type Props = {
    pane: WorkspacePaneNode;
    group?: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    accounts: Account[];
    activeAccount?: Account;
    notifications: NotificationRecord[];
    relaySets: RelaySet[];
    ready: boolean;
    pageDataReady: boolean;
    inactiveRetentionSeconds: number;
    relaySnapshots: RelaySnapshot[];
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
  };

  let props: Props = $props();
  let active = $derived(
    props.group?.activeTabId ? props.tabs[props.group.activeTabId] : undefined,
  );
  let previousActiveId = $state<string | undefined>();
  let previousRetentionSeconds = $state<number | undefined>();
  let retained = $state<Record<string, WorkspaceTab>>({});
  const bodyScroll = new PaneScrollRetention();
  const retention = new TabRetention<WorkspaceTab>(
    () =>
      (retained = Object.fromEntries(
        retention.records().map((tab) => [tab.id, tab]),
      )),
  );
  let activeBody = $derived(
    active ? (retained[active.id] ?? active) : undefined,
  );
  let renderedTabs = $derived([
    ...(activeBody ? [activeBody] : []),
    ...Object.values(retained).filter(
      (tab) =>
        tab.id !== activeBody?.id &&
        props.group?.tabIds.includes(tab.id) &&
        props.tabs[tab.id],
    ),
  ]);

  $effect(() => {
    const activeId = active?.id;
    if (previousActiveId && previousActiveId !== activeId)
      bodyScroll.remember(previousActiveId);
    if (activeId) retention.keep(activeId);
    if (activeId) bodyScroll.restore(activeId);
    if (
      previousActiveId &&
      previousActiveId !== activeId &&
      props.inactiveRetentionSeconds > 0
    ) {
      const previous = props.tabs[previousActiveId];
      if (previous && props.group?.tabIds.includes(previous.id))
        retention.retain(previous, props.inactiveRetentionSeconds);
    }
    previousActiveId = activeId;
  });

  $effect(() => {
    if (previousRetentionSeconds !== props.inactiveRetentionSeconds) {
      retention.releaseAll();
      previousRetentionSeconds = props.inactiveRetentionSeconds;
    }
    if (props.inactiveRetentionSeconds > 0) return;
    retention.releaseAll();
  });

  $effect(() => {
    retention.releaseMissing(new Set(props.group?.tabIds ?? []));
  });

  function trackBody(node: HTMLElement, tabId: string) {
    return bodyScroll.track(tabId, node);
  }

  onDestroy(() => retention.releaseAll());
</script>

<section class="pane" data-pane-id={props.pane.id} aria-label="Workspace pane">
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
    <PaneDropLayer
      paneId={props.pane.id}
      targetIndex={props.group?.tabIds.length ?? 0}
      disabled={!props.ready}
      moveTab={props.moveTab}
    />
    {#if renderedTabs.length > 0}
      {#each renderedTabs as tab (tab.id)}
        <div
          class="pane-body"
          data-active-tab={tab.id === active?.id}
          aria-hidden={tab.id === active?.id ? undefined : 'true'}
          use:trackBody={tab.id}
        >
          <PaneTabBody
            {tab}
            visible={tab.id === active?.id}
            paneId={props.pane.id}
            accounts={props.accounts}
            activeAccount={props.activeAccount}
            notifications={props.notifications}
            relaySets={props.relaySets}
            pageDataReady={props.pageDataReady}
            relaySnapshots={props.relaySnapshots}
            convertTab={props.convertTab}
            addMinedSigning={props.addMinedSigning}
            refreshData={props.refreshData}
            toggleRelay={props.toggleRelay}
            removeRelay={props.removeRelay}
            openProfile={props.openProfile}
            openProfileEdit={props.openProfileEdit}
            openThread={props.openThread}
            openAuthorContext={props.openAuthorContext}
          />
        </div>
      {/each}
    {/if}
  </div>
</section>
