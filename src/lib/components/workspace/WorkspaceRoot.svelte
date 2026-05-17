<script lang="ts">
  import type { Account } from '$lib/accounts/account';
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
    status: string;
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    openTab: (paneId: string | null, kind: TabKind) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    closePane: (paneId: string) => void;
    resize: (splitId: string, handleIndex: number, deltaRatio: number) => void;
    restoreWorkspace: () => void;
    addReadonly: () => void;
    addNip07: () => void;
    createDraft: () => void;
    toggleSidebar: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
  const actions: readonly [TabKind, string][] = [
    ['timeline', 'Timeline'],
    ['notifications', 'Notifications'],
    ['profile', 'Profile'],
    ['account-manager', 'Accounts'],
    ['post-manager', 'Posts'],
    ['relay-monitor', 'Relays'],
    ['settings', 'Settings'],
    ['cache-status', 'Cache'],
    ['composer', 'Compose'],
  ];
</script>

<main
  class:sidebar-collapsed={!props.workspace.activityBarVisible}
  class="workspace-shell"
>
  {#if props.workspace.activityBarVisible}
    <aside class="activity-bar" aria-label="Activity">
      <strong>lkjstr</strong>
      {#each actions as [kind, label] (kind)}
        <button type="button" onclick={() => props.openTab(null, kind)}>
          {label}
        </button>
      {/each}
      <button
        type="button"
        aria-label="Collapse sidebar"
        onclick={props.toggleSidebar}
      >
        Hide
      </button>
    </aside>
  {:else}
    <aside class="activity-rail" aria-label="Sidebar rail">
      <button
        type="button"
        aria-label="Expand sidebar"
        onclick={props.toggleSidebar}
      >
        Menu
      </button>
    </aside>
  {/if}
  <section class="workspace-main">
    <header class="top-bar">
      <button
        type="button"
        aria-label="Toggle sidebar"
        onclick={props.toggleSidebar}
      >
        Menu
      </button>
      <span>{props.status}</span>
    </header>
    {#if props.workspace.layout}
      <SplitNode
        node={props.workspace.layout}
        groups={props.workspace.tabGroups}
        tabs={props.workspace.tabs}
        {...props}
      />
    {/if}
    <footer class="status-bar">
      <span>{Object.keys(props.workspace.tabs).length} tabs</span>
      <span>{props.accounts.length} accounts</span>
      <span>{props.notifications.length} unread candidates</span>
    </footer>
  </section>
</main>
