<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import AppHeader from '$lib/components/app/AppHeader.svelte';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { TabKind } from '$lib/workspace/tab';
  import type { Workspace } from '$lib/workspace/workspace';
  import SplitNode from './SplitNode.svelte';

  type Props = {
    workspace: Workspace;
    accounts: Account[];
    notifications: NotificationRecord[];
    postNodes: PostTreeNode[];
    relaySets: RelaySet[];
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
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
    restoreWorkspace: () => void;
    addReadonly: () => void;
    addNip07: () => void;
    createDraft: () => void;
    refreshData: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
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
        notifications={props.notifications}
        postNodes={props.postNodes}
        relaySets={props.relaySets}
        focusTab={props.focusTab}
        closeTab={props.closeTab}
        openTab={props.openTab}
        openNewTab={props.openNewTab}
        convertTab={props.convertTab}
        split={props.split}
        closePane={props.closePane}
        resize={props.resize}
        addReadonly={props.addReadonly}
        addNip07={props.addNip07}
        createDraft={props.createDraft}
        refreshData={props.refreshData}
        toggleRelay={props.toggleRelay}
        removeRelay={props.removeRelay}
      />
    {/if}
  </section>
</main>
