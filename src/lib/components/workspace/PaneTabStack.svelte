<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';
  import { feedAnchorFromPayload } from '$lib/workspace/tab-snapshot-persist';
  import type { PaneScrollRetention } from '$lib/workspace/pane-scroll-retention';
  import PaneTabBody from './PaneTabBody.svelte';

  type Props = {
    group: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    paneId: string;
    restorePayload?: TabSnapshotPayload;
    accounts: Account[];
    activeAccount?: Account;
    relaySets: RelaySet[];
    pageDataReady: boolean;
    trackBody: (node: HTMLElement, tabId: string) => { destroy: () => void };
    convertTab: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
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

  let {
    trackBody,
    group,
    tabs,
    paneId,
    restorePayload,
    accounts,
    activeAccount,
    relaySets,
    pageDataReady,
    convertTab,
    addMinedSigning,
    refreshData,
    toggleRelay,
    removeRelay,
    openProfile,
    openProfileEdit,
    openThread,
    openAuthorContext,
    openTool,
  }: Props = $props();
</script>

{#each group.tabIds as tabId (tabId)}
  {@const tab = tabs[tabId]}
  {@const isActive = group.activeTabId === tabId}
  {#if tab}
    <div
      class="pane-body"
      data-active-tab={isActive}
      aria-hidden={!isActive}
      use:trackBody={tabId}
    >
      <PaneTabBody
        {tab}
        visible={isActive}
        {paneId}
        restoreAnchor={isActive
          ? feedAnchorFromPayload(restorePayload)
          : undefined}
        restoreSnapshot={isActive ? restorePayload : undefined}
        restoreScrollTop={isActive ? restorePayload?.scrollTop : undefined}
        {accounts}
        {activeAccount}
        {relaySets}
        {pageDataReady}
        {convertTab}
        {addMinedSigning}
        {refreshData}
        {toggleRelay}
        {removeRelay}
        {openProfile}
        {openProfileEdit}
        {openThread}
        {openAuthorContext}
        {openTool}
      />
    </div>
  {/if}
{/each}
