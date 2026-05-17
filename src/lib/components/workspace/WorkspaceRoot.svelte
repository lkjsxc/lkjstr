<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { TabKind } from '$lib/workspace/tab';
  import type { Workspace } from '$lib/workspace/workspace';
  import EmptyWorkspace from './EmptyWorkspace.svelte';
  import SplitNode from './SplitNode.svelte';

  type Props = {
    workspace: Workspace;
    accounts: Account[];
    notifications: NotificationRecord[];
    postNodes: PostTreeNode[];
    relaySets: RelaySet[];
    status: string;
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
    restoreWorkspace: () => void;
    addReadonly: () => void;
    addNip07: () => void;
    createDraft: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
</script>

<main class="workspace-shell">
  <aside class="activity-bar" aria-label="Activity">
    <strong>lkjstr</strong>
    <button
      type="button"
      onclick={() =>
        props.openTab(props.workspace.focusedPaneId, 'account-manager')}
      >Accounts</button
    >
    <button
      type="button"
      onclick={() =>
        props.openTab(props.workspace.focusedPaneId, 'notifications')}
      >Notices</button
    >
    <button
      type="button"
      onclick={() =>
        props.openTab(props.workspace.focusedPaneId, 'post-manager')}
      >Posts</button
    >
    <button
      type="button"
      onclick={() =>
        props.openTab(props.workspace.focusedPaneId, 'relay-monitor')}
      >Relays</button
    >
    <button
      type="button"
      onclick={() => props.openTab(props.workspace.focusedPaneId, 'settings')}
      >Settings</button
    >
    <button
      type="button"
      onclick={() =>
        props.openTab(props.workspace.focusedPaneId, 'cache-status')}
      >Cache</button
    >
    <button
      type="button"
      onclick={() => props.openTab(props.workspace.focusedPaneId, 'composer')}
      >Compose</button
    >
    <button
      type="button"
      onclick={() => props.openTab(props.workspace.focusedPaneId, 'timeline')}
      >Timeline</button
    >
  </aside>
  <section class="workspace-main">
    <header class="top-bar">
      <span>{props.status}</span>
      <button
        type="button"
        onclick={() => props.openTab(props.workspace.focusedPaneId, 'composer')}
        >Compose</button
      >
    </header>
    {#if props.workspace.layout}
      <SplitNode
        node={props.workspace.layout}
        groups={props.workspace.tabGroups}
        tabs={props.workspace.tabs}
        {...props}
      />
    {:else}
      <EmptyWorkspace
        openTab={props.openTab}
        restoreWorkspace={props.restoreWorkspace}
        addReadonly={props.addReadonly}
      />
    {/if}
    <footer class="status-bar">
      <span>{Object.keys(props.workspace.tabs).length} tabs</span>
      <span>{props.accounts.length} accounts</span>
      <span>{props.notifications.length} unread candidates</span>
    </footer>
  </section>
</main>
