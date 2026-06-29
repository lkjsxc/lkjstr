<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import AppHeader from '$lib/components/app/AppHeader.svelte';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { ProtectedStorageState } from '$lib/storage/protected-storage-state';
  import { onDestroy, setContext } from 'svelte';
  import type { TabKind } from '$lib/workspace/tab';
  import {
    createTabDragState,
    tabDragStateKey,
  } from '$lib/workspace/tab-drag-state';
  import type { Workspace } from '$lib/workspace/workspace';
  import { setTabSnapshotCoordinator } from '$lib/workspace/tab-snapshot-context';
  import type { TabSnapshotCoordinator } from '$lib/workspace/tab-snapshot-coordinator';
  import SplitNode from './SplitNode.svelte';

  type Props = {
    workspace: Workspace;
    accounts: Account[];
    activeAccount?: Account;
    relaySets: RelaySet[];
    storageState?: ProtectedStorageState;
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
    resize: (splitId: string, handleIndex: number, deltaRatio: number) => void;
    addMinedSigning: (nsec: string) => Promise<void>;
    refreshData: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
    openProfile: (paneId: string, pubkey: string) => void;
    openFollowees: (paneId: string, pubkey: string) => void;
    openUserTimeline: (paneId: string, pubkey: string) => void;
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
  setContext(tabDragStateKey, createTabDragState());
  setTabSnapshotCoordinator(() => props.snapshotCoordinator);
  onDestroy(() => props.snapshotCoordinator.releaseAll());
</script>

<main class="workspace-shell">
  <section class="workspace-main">
    <AppHeader />
    {#if props.storageState}
      <section class="storage-state" data-testid="storage-busy-state">
        <strong>Storage {props.storageState.kind}</strong>
        <span>{props.storageState.message}</span>
        <span>Reason: {props.storageState.reason}</span>
      </section>
    {/if}
    {#if props.workspace.layout}
      <SplitNode
        workspaceId={props.workspace.id}
        node={props.workspace.layout}
        groups={props.workspace.tabGroups}
        tabs={props.workspace.tabs}
        accounts={props.accounts}
        activeAccount={props.activeAccount}
        relaySets={props.relaySets}
        ready={props.ready}
        pageDataReady={props.pageDataReady}
        inactiveRetentionSeconds={props.inactiveRetentionSeconds}
        snapshotCoordinator={props.snapshotCoordinator}
        focusTab={props.focusTab}
        closeTab={props.closeTab}
        moveTab={props.moveTab}
        openNewTab={props.openNewTab}
        convertTab={props.convertTab}
        split={props.split}
        closePane={props.closePane}
        resize={props.resize}
        addMinedSigning={props.addMinedSigning}
        refreshData={props.refreshData}
        toggleRelay={props.toggleRelay}
        removeRelay={props.removeRelay}
        openProfile={props.openProfile}
        openFollowees={props.openFollowees}
        openUserTimeline={props.openUserTimeline}
        openProfileEdit={props.openProfileEdit}
        openThread={props.openThread}
        openAuthorContext={props.openAuthorContext}
        openTool={props.openTool}
      />
    {/if}
  </section>
</main>

<style>
  .storage-state {
    margin: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--color-border, #444);
    border-radius: 0.5rem;
    background: var(--color-panel, #111);
  }
  .storage-state span {
    display: block;
    margin-top: 0.25rem;
  }
</style>
