<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { WorkspaceLayoutNode } from '$lib/workspace/layout-tree';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import Pane from './Pane.svelte';
  import RecursiveSplit from './SplitNode.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  type Props = {
    workspaceId: string;
    node: WorkspaceLayoutNode;
    groups: Record<string, TabGroup>;
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
    resize: (splitId: string, handleIndex: number, deltaRatio: number) => void;
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
  let splitElement: HTMLElement | undefined = $state();
</script>

{#if props.node.type === 'pane'}
  {@const group = props.groups[props.node.tabGroupId]}
  <Pane
    workspaceId={props.workspaceId}
    pane={props.node}
    {group}
    tabs={props.tabs}
    accounts={props.accounts}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    ready={props.ready}
    pageDataReady={props.pageDataReady}
    inactiveRetentionSeconds={props.inactiveRetentionSeconds}
    focusTab={props.focusTab}
    closeTab={props.closeTab}
    moveTab={props.moveTab}
    openNewTab={props.openNewTab}
    convertTab={props.convertTab}
    split={props.split}
    closePane={props.closePane}
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
{:else}
  <div class={`split ${props.node.direction}`} bind:this={splitElement}>
    {#each props.node.children as child, index (child.id)}
      <div
        class="split-child"
        style={`flex: ${props.node.sizes[index] ?? 1} 1 0`}
      >
        <RecursiveSplit
          workspaceId={props.workspaceId}
          node={child}
          groups={props.groups}
          tabs={props.tabs}
          accounts={props.accounts}
          activeAccount={props.activeAccount}
          relaySets={props.relaySets}
          ready={props.ready}
          pageDataReady={props.pageDataReady}
          inactiveRetentionSeconds={props.inactiveRetentionSeconds}
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
          openProfileEdit={props.openProfileEdit}
          openThread={props.openThread}
          openAuthorContext={props.openAuthorContext}
          openTool={props.openTool}
        />
      </div>
      {#if index < props.node.children.length - 1}
        <ResizeHandle
          direction={props.node.direction}
          container={splitElement}
          resize={(delta) => props.resize(props.node.id, index, delta)}
        />
      {/if}
    {/each}
  </div>
{/if}
