<script lang="ts">
  import { onMount } from 'svelte';
  import { logRuntimeError } from '$lib/app/runtime-log';
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import {
    removeRelay,
    setRelayEnabled,
    type RelaySet,
  } from '$lib/relays/relay-store';
  import WorkspaceRoot from '$lib/components/workspace/WorkspaceRoot.svelte';
  import {
    addMinedReadonly,
    promptAddNip07,
    promptAddReadonly,
  } from '$lib/workspace/account-actions';
  import { openProfileTab, openThreadTab } from '$lib/workspace/action-tabs';
  import { moveWorkspaceTab } from '$lib/workspace/move-tab';
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
  import { bootstrapWorkspace } from '$lib/workspace/workspace-bootstrap';
  import { loadWorkspacePageData } from '$lib/workspace/workspace-page-data';
  import {
    loadWorkspace,
    saveWorkspace,
  } from '$lib/workspace/workspace-persistence';

  let workspace = $state<Workspace>(bootstrapWorkspace());
  let accounts = $state<Account[]>([]);
  let activeAccount = $state<Account>();
  let notifications = $state<NotificationRecord[]>([]);
  let relaySets = $state<RelaySet[]>([]);
  let ready = $state(false);

  onMount(async () => {
    ready = true;
    const initialWorkspace = workspace;
    let hadUserInput = false;
    const markUserInput = () => (hadUserInput = true);
    window.addEventListener('pointerdown', markUserInput, { capture: true });
    const loaded = await loadWorkspace().catch((error: unknown) => {
      logRuntimeError('workspace-load-failed')(error);
      return initialWorkspace;
    });
    window.removeEventListener('pointerdown', markUserInput, { capture: true });
    if (workspace === initialWorkspace && !hadUserInput) workspace = loaded;
    else
      await saveWorkspace(workspace).catch(
        logRuntimeError('workspace-save-failed'),
      );
    await refreshData().catch(logRuntimeError('workspace-refresh-failed'));
  });

  async function update(next: Workspace): Promise<void> {
    workspace = next;
    await saveWorkspace(next).catch(logRuntimeError('workspace-save-failed'));
  }

  async function refreshData(): Promise<void> {
    ({ accounts, activeAccount, notifications, relaySets } =
      await loadWorkspacePageData());
  }

  async function handleOpenTab(
    paneId: string | null,
    kind: TabKind,
  ): Promise<void> {
    const config =
      kind === 'profile' ? { pubkey: accounts[0]?.pubkey ?? '' } : {};
    await update(openTab(workspace, paneId, kind, titleFor(kind), config));
  }

  async function handleOpenNewTab(paneId: string): Promise<void> {
    if (workspace) await update(openNewTabChooser(workspace, paneId));
  }

  async function handleConvertTab(
    tabId: string,
    kind: TabKind,
    config: Record<string, unknown> = {},
  ): Promise<void> {
    if (workspace)
      await update(convertWorkspaceTab(workspace, tabId, kind, config));
  }

  async function handleOpenProfile(
    paneId: string,
    pubkey: string,
  ): Promise<void> {
    if (workspace) await update(openProfileTab(workspace, paneId, pubkey));
  }

  async function handleOpenThread(
    paneId: string,
    eventId: string,
  ): Promise<void> {
    if (workspace) await update(openThreadTab(workspace, paneId, eventId));
  }

  async function handleSplit(
    paneId: string,
    direction: 'horizontal' | 'vertical',
  ): Promise<void> {
    if (workspace)
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

  function handleMoveTab(
    sourcePaneId: string,
    targetPaneId: string,
    tabId: string,
    targetIndex: number,
  ): Promise<void> {
    const move = { sourcePaneId, targetPaneId, tabId, targetIndex };
    return workspace
      ? update(moveWorkspaceTab(workspace, move))
      : Promise.resolve();
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

<!-- prettier-ignore -->
<WorkspaceRoot {workspace} {accounts} {activeAccount} {notifications} {relaySets} {ready} focusTab={handleFocusTab} closeTab={handleCloseTab} moveTab={handleMoveTab} openTab={handleOpenTab} openNewTab={handleOpenNewTab} convertTab={handleConvertTab} split={handleSplit} closePane={handleClosePane} resize={handleResize} addReadonly={() => promptAddReadonly(refreshData)} addNip07={() => promptAddNip07(refreshData)} addReadonlyPubkey={(pubkey) => addMinedReadonly(pubkey, refreshData)} {refreshData} toggleRelay={handleToggleRelay} removeRelay={handleRemoveRelay} openProfile={handleOpenProfile} openThread={handleOpenThread} />
