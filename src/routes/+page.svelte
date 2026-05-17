<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import {
    removeRelay,
    setRelayEnabled,
    type RelaySet,
  } from '$lib/relays/relay-store';
  import WorkspaceRoot from '$lib/components/workspace/WorkspaceRoot.svelte';
  import { closeWorkspacePane } from '$lib/workspace/pane-commands';
  import { resizeSplit } from '$lib/workspace/resize';
  import type { TabKind } from '$lib/workspace/tab';
  import {
    closeWorkspaceTab,
    convertWorkspaceTab,
    focusTab,
    openNewTabChooser,
    openTab,
    splitFocusedPane,
    titleFor,
    type Workspace,
  } from '$lib/workspace/workspace';
  import {
    addNip07FromProvider,
    addReadonlyFromInput,
    createDraftForActiveAccount,
    loadWorkspacePageData,
  } from '$lib/workspace/workspace-page-data';
  import {
    loadWorkspace,
    resetWorkspace,
    saveWorkspace,
  } from '$lib/workspace/workspace-persistence';

  let workspace = $state<Workspace>();
  let accounts = $state<Account[]>([]);
  let notifications = $state<NotificationRecord[]>([]);
  let postNodes = $state<PostTreeNode[]>([]);
  let relaySets = $state<RelaySet[]>([]);

  onMount(async () => {
    workspace = await loadWorkspace();
    await refreshData();
  });

  async function update(next: Workspace): Promise<void> {
    workspace = next;
    await saveWorkspace(next);
  }

  async function refreshData(): Promise<void> {
    ({ accounts, notifications, postNodes, relaySets } =
      await loadWorkspacePageData());
  }

  async function handleOpenTab(
    paneId: string | null,
    kind: TabKind,
  ): Promise<void> {
    if (!workspace) return;
    const config =
      kind === 'profile' ? { pubkey: accounts[0]?.pubkey ?? '' } : {};
    await update(openTab(workspace, paneId, kind, titleFor(kind), config));
  }

  async function handleOpenNewTab(paneId: string): Promise<void> {
    if (!workspace) return;
    await update(openNewTabChooser(workspace, paneId));
  }

  async function handleConvertTab(
    tabId: string,
    kind: TabKind,
    config: Record<string, unknown> = {},
  ): Promise<void> {
    if (!workspace) return;
    await update(convertWorkspaceTab(workspace, tabId, kind, config));
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
    if (workspace?.layout)
      await update({
        ...workspace,
        layout: resizeSplit(workspace.layout, splitId, handleIndex, deltaRatio),
      });
  }

  async function handleAddReadonly(): Promise<void> {
    const input = window.prompt('npub or hex pubkey');
    if (!input) return;
    try {
      await addReadonlyFromInput(input);
      await refreshData();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : 'Account add failed.',
      );
    }
  }

  async function handleAddNip07(): Promise<void> {
    try {
      await addNip07FromProvider();
      await refreshData();
    } catch {
      window.alert('NIP-07 unavailable.');
    }
  }

  async function handleCreateDraft(): Promise<void> {
    await createDraftForActiveAccount();
    await refreshData();
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

  function handleClosePane(paneId: string): Promise<void> {
    return workspace
      ? update(closeWorkspacePane(workspace, paneId))
      : Promise.resolve();
  }

  async function handleRestoreWorkspace(): Promise<void> {
    workspace = await resetWorkspace();
  }

  async function handleToggleRelay(
    setId: string,
    url: string,
    enabled: boolean,
  ) {
    relaySets = await setRelayEnabled(setId, url, enabled);
  }

  async function handleRemoveRelay(setId: string, url: string) {
    relaySets = await removeRelay(setId, url);
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
    {relaySets}
    focusTab={handleFocusTab}
    closeTab={handleCloseTab}
    openTab={handleOpenTab}
    openNewTab={handleOpenNewTab}
    convertTab={handleConvertTab}
    split={handleSplit}
    closePane={handleClosePane}
    resize={handleResize}
    restoreWorkspace={handleRestoreWorkspace}
    addReadonly={handleAddReadonly}
    addNip07={handleAddNip07}
    createDraft={handleCreateDraft}
    {refreshData}
    toggleRelay={handleToggleRelay}
    removeRelay={handleRemoveRelay}
  />
{/if}
