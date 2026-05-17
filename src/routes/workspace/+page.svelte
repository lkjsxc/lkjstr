<script lang="ts">
  import { onMount } from 'svelte';
  import {
    addNip07Account,
    addReadonlyAccount,
  } from '$lib/accounts/account-manager';
  import { activeAccount, listAccounts } from '$lib/accounts/account-store';
  import type { Account } from '$lib/accounts/account';
  import { accountNotifications } from '$lib/notifications/notification-store';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import {
    createDraftNode,
    getOrCreatePostTree,
    treeNodes,
  } from '$lib/post-manager/post-store';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import { equalizeSplit, resizeSplit } from '$lib/workspace/resize';
  import type { TabKind } from '$lib/workspace/tab';
  import {
    closeWorkspaceTab,
    focusTab,
    openTab,
    splitFocusedPane,
    titleFor,
    type Workspace,
  } from '$lib/workspace/workspace';
  import {
    loadWorkspace,
    saveWorkspace,
  } from '$lib/workspace/workspace-persistence';
  import WorkspaceRoot from '$lib/components/workspace/WorkspaceRoot.svelte';

  let workspace = $state<Workspace>();
  let accounts = $state<Account[]>([]);
  let notifications = $state<NotificationRecord[]>([]);
  let postNodes = $state<PostTreeNode[]>([]);
  let status = $state('Workspace loading.');

  onMount(async () => {
    workspace = await loadWorkspace();
    await refreshData();
    status = 'Workspace restored from IndexedDB.';
  });

  async function update(next: Workspace): Promise<void> {
    workspace = next;
    try {
      await saveWorkspace(next);
      status = 'Workspace saved.';
    } catch {
      status = 'Workspace snapshot saved; IndexedDB write failed.';
    }
  }

  async function refreshData(): Promise<void> {
    accounts = await listAccounts();
    const active = await activeAccount();
    notifications = active ? await accountNotifications(active.pubkey) : [];
    if (!active) {
      postNodes = [];
      return;
    }
    const tree = await getOrCreatePostTree(active.pubkey);
    postNodes = await treeNodes(tree.id);
  }

  async function handleOpenTab(paneId: string, kind: TabKind): Promise<void> {
    if (!workspace) return;
    const config =
      kind === 'profile' ? { pubkey: accounts[0]?.pubkey ?? '' } : {};
    await update(openTab(workspace, paneId, kind, titleFor(kind), config));
  }

  async function handleSplit(
    paneId: string,
    direction: 'horizontal' | 'vertical',
  ): Promise<void> {
    if (!workspace) return;
    await update(
      splitFocusedPane({ ...workspace, focusedPaneId: paneId }, direction),
    );
  }

  async function handleResize(
    splitId: string,
    handleIndex: number,
    deltaRatio: number,
  ): Promise<void> {
    if (!workspace) return;
    await update({
      ...workspace,
      layout: resizeSplit(workspace.layout, splitId, handleIndex, deltaRatio),
    });
  }

  async function handleEqualize(splitId: string): Promise<void> {
    if (!workspace) return;
    await update({
      ...workspace,
      layout: equalizeSplit(workspace.layout, splitId),
    });
  }

  async function handleAddReadonly(): Promise<void> {
    const input = window.prompt('npub or hex pubkey');
    if (!input) return;
    try {
      await addReadonlyAccount(input);
      await refreshData();
      status = 'Read-only account added.';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Account add failed.';
    }
  }

  async function handleAddNip07(): Promise<void> {
    try {
      await addNip07Account();
      await refreshData();
      status = 'NIP-07 account added.';
    } catch (error) {
      status = error instanceof Error ? error.message : 'NIP-07 unavailable.';
    }
  }

  async function handleCreateDraft(): Promise<void> {
    const active = await activeAccount();
    if (!active) {
      status = 'Add an account before creating drafts.';
      return;
    }
    const tree = await getOrCreatePostTree(active.pubkey);
    await createDraftNode(tree, 'Untitled draft');
    postNodes = await treeNodes(tree.id);
    status = 'Draft node created.';
  }

  function handleFocusTab(paneId: string, tabId: string): Promise<void> {
    return workspace
      ? update(focusTab(workspace, paneId, tabId))
      : Promise.resolve();
  }

  function handleCloseTab(paneId: string, tabId: string): Promise<void> {
    return workspace
      ? update(closeWorkspaceTab(workspace, paneId, tabId))
      : Promise.resolve();
  }
</script>

<svelte:head>
  <title>lkjstr workspace</title>
</svelte:head>

{#if workspace}
  <WorkspaceRoot
    {workspace}
    {accounts}
    {notifications}
    {postNodes}
    {status}
    focusTab={handleFocusTab}
    closeTab={handleCloseTab}
    openTab={handleOpenTab}
    split={handleSplit}
    resize={handleResize}
    equalize={handleEqualize}
    addReadonly={handleAddReadonly}
    addNip07={handleAddNip07}
    createDraft={handleCreateDraft}
  />
{/if}
