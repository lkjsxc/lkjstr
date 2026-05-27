<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { WorkspacePaneNode } from '$lib/workspace/pane';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { TabSnapshotRestore } from '$lib/workspace/tab-snapshot';
  import type { TabSnapshotCoordinator } from '$lib/workspace/tab-snapshot-coordinator';
  import PaneDropLayer from './PaneDropLayer.svelte';
  import PaneHead from './PaneHead.svelte';
  import PaneTabStack from './PaneTabStack.svelte';

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
    snapshotCoordinator: TabSnapshotCoordinator;
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
  let restoreByTabId = $state<Record<string, TabSnapshotRestore>>({});
  let active = $derived(
    props.group?.activeTabId ? props.tabs[props.group.activeTabId] : undefined,
  );
  let previousActiveId = $state<string | undefined>();
  let previousRetentionSeconds = $state<number | undefined>();
  let loadedSnapshotTabsKey = $state('');

  $effect.pre(() => {
    const activeId = active?.id;
    if (previousActiveId && previousActiveId !== activeId)
      props.snapshotCoordinator.rememberScroll(previousActiveId);
  });

  $effect(() => {
    const activeId = active?.id;
    void props.snapshotCoordinator
      .syncFocus({
        paneId: props.pane.id,
        active,
        previousActiveId,
        tabs: props.tabs,
        group: props.group,
      })
      .then(() => {
        if (activeId)
          restoreByTabId = props.snapshotCoordinator.restoreRecords();
      });
    previousActiveId = activeId;
  });

  $effect(() => {
    if (previousRetentionSeconds !== props.inactiveRetentionSeconds) {
      props.snapshotCoordinator.setRetentionSeconds(
        props.inactiveRetentionSeconds,
      );
      previousRetentionSeconds = props.inactiveRetentionSeconds;
    }
  });

  $effect(() => {
    const tabIds = props.group?.tabIds ?? [];
    if (!props.ready || tabIds.length === 0) return;
    const loadKey = `${props.workspaceId}:${tabIds.join('|')}`;
    if (loadKey === loadedSnapshotTabsKey) return;
    loadedSnapshotTabsKey = loadKey;
    void props.snapshotCoordinator
      .loadTabs(tabIds)
      .then(
        () => (restoreByTabId = props.snapshotCoordinator.restoreRecords()),
      );
  });

  function trackBody(node: HTMLElement, tabId: string) {
    return props.snapshotCoordinator.trackBody(tabId, node);
  }
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
  <PaneHead
    paneId={props.pane.id}
    group={props.group}
    tabs={props.tabs}
    ready={props.ready}
    focusTab={props.focusTab}
    closeTab={props.closeTab}
    moveTab={props.moveTab}
    openNewTab={props.openNewTab}
    split={props.split}
    closePane={props.closePane}
  />

  <div class="pane-stack">
    {#if props.group}
      <PaneTabStack
        group={props.group}
        tabs={props.tabs}
        paneId={props.pane.id}
        {restoreByTabId}
        accounts={props.accounts}
        activeAccount={props.activeAccount}
        relaySets={props.relaySets}
        pageDataReady={props.pageDataReady}
        {trackBody}
        consumeRestore={props.snapshotCoordinator.consumeRestore}
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
