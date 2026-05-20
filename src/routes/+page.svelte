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
    openProfileEditTab,
    openProfileTab,
    openThreadTab,
  } from '$lib/workspace/action-tabs';
  import { moveWorkspaceTab } from '$lib/workspace/move-tab';
  import { closeWorkspacePane } from '$lib/workspace/pane-commands';
  import { resizeSplit } from '$lib/workspace/resize';
  import type { TabKind } from '$lib/workspace/tab';
  import {
    closeWorkspaceTab,
    convertWorkspaceTab,
    focusTab,
    openNewTabChooser,
    splitFocusedPane,
    type Workspace,
  } from '$lib/workspace/workspace';
  import { bootstrapWorkspace } from '$lib/workspace/workspace-bootstrap';
  import {
    addMinedSigningAccount,
    loadWorkspacePageData,
  } from '$lib/workspace/workspace-page-data';
  import {
    loadWorkspace,
    saveWorkspace,
  } from '$lib/workspace/workspace-persistence';
  import {
    loadInactiveRetentionSeconds,
    settingsChangedEvent,
  } from '$lib/workspace/runtime-settings';

  let workspace = $state<Workspace>(bootstrapWorkspace());
  let accounts = $state<Account[]>([]);
  let activeAccount = $state<Account>();
  let notifications = $state<NotificationRecord[]>([]);
  let relaySets = $state<RelaySet[]>([]);
  let ready = $state(false);
  let pageDataReady = $state(false);
  let inactiveRetentionSeconds = $state(300);

  onMount(() => {
    let disposed = false;
    const refreshSettings = () => {
      if (!disposed)
        void refreshRuntimeSettings().catch(
          logRuntimeError('settings-load-failed'),
        );
    };
    window.addEventListener(settingsChangedEvent, refreshSettings);
    void initializeWorkspace().catch(logRuntimeError('workspace-init-failed'));
    return () => {
      disposed = true;
      window.removeEventListener(settingsChangedEvent, refreshSettings);
    };
  });

  async function initializeWorkspace(): Promise<void> {
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
    await refreshRuntimeSettings().catch(
      logRuntimeError('settings-load-failed'),
    );
  }

  async function update(next: Workspace): Promise<void> {
    workspace = next;
    await saveWorkspace(next).catch(logRuntimeError('workspace-save-failed'));
  }

  async function refreshData(): Promise<void> {
    ({ accounts, activeAccount, notifications, relaySets } =
      await loadWorkspacePageData());
    pageDataReady = true;
  }

  async function refreshRuntimeSettings(): Promise<void> {
    inactiveRetentionSeconds = await loadInactiveRetentionSeconds(
      inactiveRetentionSeconds,
    );
  }

  async function handleOpenNewTab(paneId: string): Promise<void> {
    if (workspace) await update(openNewTabChooser(workspace, paneId));
  }

  // prettier-ignore
  async function handleConvertTab(tabId: string, kind: TabKind, config: Record<string, unknown> = {}): Promise<void> {
    if (workspace)
      await update(convertWorkspaceTab(workspace, tabId, kind, config));
  }

  // prettier-ignore
  async function handleOpenProfile(paneId: string, pubkey: string): Promise<void> {
    if (workspace) await update(openProfileTab(workspace, paneId, pubkey));
  }

  // prettier-ignore
  async function handleOpenThread(paneId: string, eventId: string): Promise<void> {
    if (workspace) await update(openThreadTab(workspace, paneId, eventId));
  }

  async function handleOpenProfileEdit(paneId: string): Promise<void> {
    if (workspace) await update(openProfileEditTab(workspace, paneId));
  }

  async function handleAddMinedSigning(nsec: string): Promise<void> {
    await addMinedSigningAccount(nsec);
    await refreshData();
  }

  // prettier-ignore
  async function handleSplit(paneId: string, direction: 'horizontal' | 'vertical'): Promise<void> {
    if (workspace)
      await update(
        splitFocusedPane({ ...workspace, focusedPaneId: paneId }, direction),
      );
  }

  // prettier-ignore
  async function handleResize(splitId: string, handleIndex: number, deltaRatio: number): Promise<void> {
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

  // prettier-ignore
  function handleMoveTab(sourcePaneId: string, targetPaneId: string, tabId: string, targetIndex: number): Promise<void> {
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
<WorkspaceRoot {workspace} {accounts} {activeAccount} {notifications} {relaySets} {ready} {pageDataReady} {inactiveRetentionSeconds} focusTab={handleFocusTab} closeTab={handleCloseTab} moveTab={handleMoveTab} openNewTab={handleOpenNewTab} convertTab={handleConvertTab} split={handleSplit} closePane={handleClosePane} resize={handleResize} addMinedSigning={handleAddMinedSigning} {refreshData} toggleRelay={handleToggleRelay} removeRelay={handleRemoveRelay} openProfile={handleOpenProfile} openProfileEdit={handleOpenProfileEdit} openThread={handleOpenThread} />
