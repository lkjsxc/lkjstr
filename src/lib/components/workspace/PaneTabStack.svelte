<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabSnapshotRestore } from '$lib/workspace/tab-snapshot';
  import { feedAnchorFromPayload } from '$lib/workspace/tab-snapshot-persist';
  import PaneTabBody from './PaneTabBody.svelte';

  type Props = {
    group: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    paneId: string;
    restoreByTabId: Record<string, TabSnapshotRestore>;
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
    consumeRestore: (tabId: string, restore?: TabSnapshotRestore) => void;
  };

  let {
    trackBody,
    group,
    tabs,
    paneId,
    restoreByTabId,
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
    consumeRestore,
  }: Props = $props();

  function consumeOnMount(
    _node: HTMLElement,
    input: { tabId: string; restore?: TabSnapshotRestore },
  ) {
    let lastToken = '';
    const consume = () => {
      if (!input.restore || input.restore.token === lastToken) return;
      lastToken = input.restore.token;
      consumeRestore(input.tabId, input.restore);
    };
    queueMicrotask(consume);
    return {
      update: (next: typeof input) => {
        input = next;
        queueMicrotask(consume);
      },
    };
  }
</script>

{#each group.tabIds as tabId (tabId)}
  {@const tab = tabs[tabId]}
  {@const isActive = group.activeTabId === tabId}
  {@const tabRestore = restoreByTabId[tabId]}
  {#if tab}
    <div
      class="pane-body"
      data-active-tab={isActive}
      aria-hidden={!isActive}
      use:trackBody={tabId}
      use:consumeOnMount={{ tabId, restore: tabRestore }}
    >
      <PaneTabBody
        {tab}
        visible={isActive}
        {paneId}
        restoreAnchor={feedAnchorFromPayload(tabRestore?.payload)}
        restoreSnapshot={tabRestore?.payload}
        restoreScrollTop={tabRestore?.payload.scrollTop}
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
