<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import type { TabKind } from '$lib/workspace/tab';
  import type { Workspace } from '$lib/workspace/workspace';
  import SplitNode from './SplitNode.svelte';

  type Props = {
    workspace: Workspace;
    accounts: Account[];
    notifications: NotificationRecord[];
    postNodes: PostTreeNode[];
    status: string;
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    openTab: (paneId: string, kind: TabKind) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    resize: (splitId: string, handleIndex: number, deltaRatio: number) => void;
    equalize: (splitId: string) => void;
    addReadonly: () => void;
    addNip07: () => void;
    createDraft: () => void;
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
        props.openTab(props.workspace.focusedPaneId, 'cache-status')}
      >Cache</button
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
    <SplitNode
      node={props.workspace.layout}
      groups={props.workspace.tabGroups}
      tabs={props.workspace.tabs}
      {...props}
    />
    <footer class="status-bar">
      <span>{Object.keys(props.workspace.tabs).length} tabs</span>
      <span>{props.accounts.length} accounts</span>
      <span>{props.notifications.length} unread candidates</span>
    </footer>
  </section>
</main>
