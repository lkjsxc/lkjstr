<script lang="ts">
  import { onMount } from 'svelte';
  import { closeLkjstrWebWasmStorageIfLoaded } from 'virtual:lkjstr-web-wasm';
  import { installMemoryDebugExport } from '$lib/app/memory-debug';
  import { logRuntimeError } from '$lib/app/runtime-log';
  import { enforceCacheBudget } from '$lib/cache/cache-budget-enforcement';
  import { defaultCacheMaxBytes } from '$lib/cache/storage-quota';
  import { loadSettings } from '$lib/settings/settings-store';
  import '$lib/storage/sqlite-opfs/app-broker';
  import { refreshStartupStorageDiagnostics } from '$lib/storage/sqlite-opfs/startup-diagnostics';
  import { closeSqliteStorage } from '$lib/storage/sqlite-opfs/kernel-client';
  import { installSqliteStorageTestApi } from '$lib/storage/sqlite-opfs/test-api';
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import PrivacyConsent from '$lib/components/privacy/PrivacyConsent.svelte';
  import WorkspaceRoot from '$lib/components/workspace/WorkspaceRoot.svelte';
  import { createTabSnapshotCoordinator } from '$lib/workspace/tab-snapshot-coordinator';
  import {
    captureWorkspaceSnapshots,
    cleanupWorkspaceSnapshots,
  } from '$lib/workspace/tab-snapshot-workspace';
  import type { Workspace } from '$lib/workspace/workspace';
  import { bootstrapWorkspace } from '$lib/workspace/workspace-bootstrap';
  import {
    loadWorkspacePageData,
    type WorkspacePageData,
  } from '$lib/workspace/workspace-page-data';
  import { createWorkspacePageActions } from '$lib/workspace/workspace-page-actions';
  import {
    loadWorkspace,
    saveWorkspace,
  } from '$lib/workspace/workspace-persistence';
  import { loadInactiveRetentionSeconds } from '$lib/workspace/runtime-settings';
  import { installWorkspaceSnapshotLifecycle } from '$lib/workspace/workspace-snapshot-lifecycle';

  const bootWorkspace = bootstrapWorkspace();
  let workspace = $state<Workspace>(bootWorkspace);
  let accounts = $state<Account[]>([]);
  let activeAccount = $state<Account>();
  let relaySets = $state<RelaySet[]>([]);
  let storageState = $state<WorkspacePageData['storageState']>();
  let ready = $state(false);
  let workspaceLoaded = $state(false);
  let pageDataReady = $state(false);
  let inactiveRetentionSeconds = $state(300);
  let snapshotWorkspaceId = bootWorkspace.id;
  let snapshotCoordinator = $state(newSnapshotCoordinator(snapshotWorkspaceId));
  const actions = createWorkspacePageActions({
    getWorkspace: () => workspace,
    update,
    captureAllTabs: () => void captureAllTabs(),
    snapshotCoordinator: () => snapshotCoordinator,
    refreshData,
    setRelaySets: (sets) => (relaySets = sets),
  });

  onMount(() => {
    installMemoryDebugExport();
    installSqliteStorageTestApi();
    void refreshStartupStorageDiagnostics().catch(
      logRuntimeError('storage-startup-diagnostics-failed'),
    );
    let disposed = false;
    // prettier-ignore
    const refreshSettings = () => { if (!disposed) void refreshRuntimeSettings().catch(logRuntimeError('settings-load-failed')); };
    const closeStorage = () => {
      void closeSqliteStorage();
      void closeLkjstrWebWasmStorageIfLoaded().catch(
        logRuntimeError('rust-sqlite-pagehide-close-failed'),
      );
    };
    window.addEventListener('pagehide', closeStorage);
    const disposeSnapshots = installWorkspaceSnapshotLifecycle({
      refreshSettings,
      flushSnapshots: () => void captureAllTabs(),
    });
    void initializeWorkspace().catch(logRuntimeError('workspace-init-failed'));
    return () => {
      disposed = true;
      window.removeEventListener('pagehide', closeStorage);
      disposeSnapshots();
      snapshotCoordinator.releaseAll();
    };
  });

  $effect(() => {
    if (workspace.id !== snapshotWorkspaceId) {
      snapshotCoordinator.releaseAll();
      snapshotWorkspaceId = workspace.id;
      snapshotCoordinator = newSnapshotCoordinator(workspace.id);
    } else snapshotCoordinator.setRetentionSeconds(inactiveRetentionSeconds);
    if (workspaceLoaded)
      void cleanupWorkspaceSnapshots(snapshotCoordinator, workspace);
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
    workspaceLoaded = true;
    await refreshRuntimeSettings().catch(
      logRuntimeError('settings-load-failed'),
    );
    await enforceCacheBudget('startup', {
      maxBytes: await configuredCacheMaxBytes(),
    }).catch(logRuntimeError('cache-budget-startup-failed'));
    await refreshData().catch(logRuntimeError('workspace-refresh-failed'));
  }

  async function update(next: Workspace): Promise<void> {
    workspace = next;
    await saveWorkspace(next).catch(logRuntimeError('workspace-save-failed'));
  }

  function newSnapshotCoordinator(workspaceId: string) {
    return createTabSnapshotCoordinator({
      workspaceId,
      inactiveRetentionSeconds,
    });
  }

  async function captureAllTabs(): Promise<void> {
    await captureWorkspaceSnapshots(snapshotCoordinator, workspace).catch(
      logRuntimeError('tab-snapshot-flush-failed'),
    );
  }

  async function refreshData(): Promise<void> {
    ({ accounts, activeAccount, relaySets, storageState } =
      await loadWorkspacePageData());
    pageDataReady = true;
  }

  async function refreshRuntimeSettings(): Promise<void> {
    inactiveRetentionSeconds = await loadInactiveRetentionSeconds(
      inactiveRetentionSeconds,
    );
  }

  async function configuredCacheMaxBytes(): Promise<number> {
    const setting = (await loadSettings()).find(
      (item) => item.key === 'cache.maxBytes',
    );
    return typeof setting?.value === 'number'
      ? setting.value
      : defaultCacheMaxBytes;
  }
</script>

<svelte:head><title>lkjstr</title></svelte:head>

<!-- prettier-ignore -->
<WorkspaceRoot {workspace} {accounts} {activeAccount} {relaySets} {storageState} {ready} {pageDataReady} {inactiveRetentionSeconds} {snapshotCoordinator} focusTab={actions.focusTab} closeTab={actions.closeTab} moveTab={actions.moveTab} openNewTab={actions.openNewTab} convertTab={actions.convertTab} split={actions.split} closePane={actions.closePane} resize={actions.resize} addMinedSigning={actions.addMinedSigning} {refreshData} toggleRelay={actions.toggleRelay} removeRelay={actions.removeRelay} openProfile={actions.openProfile} openFollowees={actions.openFollowees} openUserTimeline={actions.openUserTimeline} openProfileEdit={actions.openProfileEdit} openThread={actions.openThread} openAuthorContext={actions.openAuthorContext} openTool={actions.openTool} />
<PrivacyConsent />
