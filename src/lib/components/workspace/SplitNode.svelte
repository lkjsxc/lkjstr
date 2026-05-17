<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { WorkspaceLayoutNode } from '$lib/workspace/layout-tree';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import Pane from './Pane.svelte';
  import RecursiveSplit from './SplitNode.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  type Props = {
    node: WorkspaceLayoutNode;
    groups: Record<string, TabGroup>;
    tabs: Record<string, WorkspaceTab>;
    accounts: Account[];
    notifications: NotificationRecord[];
    postNodes: PostTreeNode[];
    relaySets: RelaySet[];
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    openTab: (paneId: string | null, kind: TabKind) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    splitInto: (
      paneId: string,
      direction: 'horizontal' | 'vertical',
      count: number,
    ) => void;
    closePane: (paneId: string) => void;
    resize: (splitId: string, handleIndex: number, deltaRatio: number) => void;
    equalize: (splitId: string) => void;
    addReadonly: () => void;
    addNip07: () => void;
    createDraft: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
</script>

{#if props.node.type === 'pane'}
  {@const group = props.groups[props.node.tabGroupId]}
  <Pane
    pane={props.node}
    {group}
    tabs={props.tabs}
    accounts={props.accounts}
    notifications={props.notifications}
    postNodes={props.postNodes}
    relaySets={props.relaySets}
    focusTab={props.focusTab}
    closeTab={props.closeTab}
    openTab={props.openTab}
    split={props.split}
    splitInto={props.splitInto}
    closePane={props.closePane}
    addReadonly={props.addReadonly}
    addNip07={props.addNip07}
    createDraft={props.createDraft}
    toggleRelay={props.toggleRelay}
    removeRelay={props.removeRelay}
  />
{:else}
  <div class={`split ${props.node.direction}`}>
    {#each props.node.children as child, index (child.id)}
      <div
        class="split-child"
        style={`flex: ${props.node.sizes[index] ?? 1} 1 0`}
      >
        <RecursiveSplit
          node={child}
          groups={props.groups}
          tabs={props.tabs}
          accounts={props.accounts}
          notifications={props.notifications}
          postNodes={props.postNodes}
          relaySets={props.relaySets}
          focusTab={props.focusTab}
          closeTab={props.closeTab}
          openTab={props.openTab}
          split={props.split}
          splitInto={props.splitInto}
          closePane={props.closePane}
          resize={props.resize}
          equalize={props.equalize}
          addReadonly={props.addReadonly}
          addNip07={props.addNip07}
          createDraft={props.createDraft}
          toggleRelay={props.toggleRelay}
          removeRelay={props.removeRelay}
        />
      </div>
      {#if index < props.node.children.length - 1}
        <ResizeHandle
          direction={props.node.direction}
          resize={(delta) => props.resize(props.node.id, index, delta)}
          equalize={() => props.equalize(props.node.id)}
        />
      {/if}
    {/each}
  </div>
{/if}
