<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import AppHeader from '$lib/components/app/AppHeader.svelte';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { startRelaySnapshotPolling } from '$lib/relays/session-snapshots';
  import type { RelaySnapshot } from '$lib/relays/types';
  import type { TabKind } from '$lib/workspace/tab';
  import type { Workspace } from '$lib/workspace/workspace';
  import SplitNode from './SplitNode.svelte';

  type Props = {
    workspace: Workspace;
    accounts: Account[];
    activeAccount?: Account;
    notifications: NotificationRecord[];
    relaySets: RelaySet[];
    ready: boolean;
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    moveTab: (
      sourcePaneId: string,
      targetPaneId: string,
      tabId: string,
      targetIndex: number,
    ) => void;
    openTab: (paneId: string | null, kind: TabKind) => void;
    openNewTab: (paneId: string) => void;
    convertTab: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    closePane: (paneId: string) => void;
    resize: (splitId: string, handleIndex: number, deltaRatio: number) => void;
    addReadonly: () => void;
    addNip07: () => void;
    addReadonlyPubkey: (pubkey: string) => Promise<void>;
    refreshData: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
    openProfile: (paneId: string, pubkey: string) => void;
    openThread: (paneId: string, eventId: string) => void;
  };

  let props: Props = $props();
  let relaySnapshots = $state<RelaySnapshot[]>([]);

  onMount(() =>
    startRelaySnapshotPolling((snapshots) => (relaySnapshots = snapshots)),
  );
</script>

<main class="workspace-shell">
  <section class="workspace-main">
    <AppHeader />
    {#if props.workspace.layout}
      <SplitNode
        node={props.workspace.layout}
        groups={props.workspace.tabGroups}
        tabs={props.workspace.tabs}
        accounts={props.accounts}
        activeAccount={props.activeAccount}
        notifications={props.notifications}
        relaySets={props.relaySets}
        ready={props.ready}
        {relaySnapshots}
        focusTab={props.focusTab}
        closeTab={props.closeTab}
        moveTab={props.moveTab}
        openTab={props.openTab}
        openNewTab={props.openNewTab}
        convertTab={props.convertTab}
        split={props.split}
        closePane={props.closePane}
        resize={props.resize}
        addReadonly={props.addReadonly}
        addNip07={props.addNip07}
        addReadonlyPubkey={props.addReadonlyPubkey}
        refreshData={props.refreshData}
        toggleRelay={props.toggleRelay}
        removeRelay={props.removeRelay}
        openProfile={props.openProfile}
        openThread={props.openThread}
      />
    {/if}
  </section>
</main>
