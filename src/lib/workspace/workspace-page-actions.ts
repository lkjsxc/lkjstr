import type { RelaySet } from '$lib/relays/relay-store';
import { removeRelay, setRelayEnabled } from '$lib/relays/relay-store';
import {
  openAuthorContextTab,
  openProfileEditTab,
  openProfileTab,
  openThreadTab,
} from './action-tabs';
import { moveWorkspaceTab } from './move-tab';
import { openToolTab } from './open-tool-tab';
import { closeWorkspacePane } from './pane-commands';
import { resizeSplit } from './resize';
import type { TabKind } from './tab';
import { clearTabFeedAnchor } from './tab-anchor-registry';
import type { TabSnapshotCoordinator } from './tab-snapshot-coordinator';
import {
  closeWorkspaceTab,
  convertWorkspaceTab,
  focusTab,
  openNewTabChooser,
  splitFocusedPane,
  type Workspace,
} from './workspace';
import { addMinedSigningAccount } from './workspace-page-data';

type Deps = {
  readonly getWorkspace: () => Workspace;
  readonly update: (next: Workspace) => Promise<void>;
  readonly captureAllTabs: () => void;
  readonly snapshotCoordinator: () => TabSnapshotCoordinator;
  readonly refreshData: () => Promise<void>;
  readonly setRelaySets: (sets: RelaySet[]) => void;
};

const resolved = (): Promise<void> => Promise.resolve();

export function createWorkspacePageActions(deps: Deps) {
  const updateWorkspace = (next: Workspace): Promise<void> => deps.update(next);
  return {
    openNewTab: (paneId: string): Promise<void> =>
      updateWorkspace(openNewTabChooser(deps.getWorkspace(), paneId)),
    convertTab: (
      tabId: string,
      kind: TabKind,
      config: Record<string, unknown> = {},
    ): Promise<void> =>
      updateWorkspace(
        convertWorkspaceTab(deps.getWorkspace(), tabId, kind, config),
      ),
    openProfile: (paneId: string, pubkey: string): Promise<void> =>
      updateWorkspace(openProfileTab(deps.getWorkspace(), paneId, pubkey)),
    openThread: (paneId: string, eventId: string): Promise<void> =>
      updateWorkspace(openThreadTab(deps.getWorkspace(), paneId, eventId)),
    openAuthorContext: (
      paneId: string,
      eventId: string,
      pubkey: string,
    ): Promise<void> =>
      updateWorkspace(
        openAuthorContextTab(deps.getWorkspace(), paneId, eventId, pubkey),
      ),
    openProfileEdit: (paneId: string): Promise<void> =>
      updateWorkspace(openProfileEditTab(deps.getWorkspace(), paneId)),
    addMinedSigning: async (nsec: string): Promise<void> => {
      await addMinedSigningAccount(nsec);
      await deps.refreshData();
    },
    split: (
      paneId: string,
      direction: 'horizontal' | 'vertical',
    ): Promise<void> =>
      updateWorkspace(
        splitFocusedPane(
          { ...deps.getWorkspace(), focusedPaneId: paneId },
          direction,
        ),
      ),
    resize: (
      splitId: string,
      handleIndex: number,
      deltaRatio: number,
    ): Promise<void> => {
      const workspace = deps.getWorkspace();
      if (!workspace.layout) return resolved();
      return updateWorkspace({
        ...workspace,
        layout: resizeSplit(workspace.layout, splitId, handleIndex, deltaRatio),
      });
    },
    focusTab: (paneId: string, tabId: string): Promise<void> =>
      updateWorkspace(focusTab(deps.getWorkspace(), paneId, tabId)),
    closeTab: (paneId: string, tabId: string): Promise<void> => {
      const workspace = deps.getWorkspace();
      clearTabFeedAnchor(tabId);
      const tab = workspace.tabs[tabId];
      if (tab)
        void deps
          .snapshotCoordinator()
          .captureTab(paneId, tab)
          .then(() => deps.snapshotCoordinator().deleteTab(tabId));
      return updateWorkspace(closeWorkspaceTab(workspace, paneId, tabId));
    },
    openTool: (paneId: string, kind: TabKind): Promise<void> =>
      updateWorkspace(openToolTab(deps.getWorkspace(), paneId, kind)),
    closePane: (paneId: string): Promise<void> => {
      deps.captureAllTabs();
      return updateWorkspace(closeWorkspacePane(deps.getWorkspace(), paneId));
    },
    moveTab: (
      sourcePaneId: string,
      targetPaneId: string,
      tabId: string,
      targetIndex: number,
      edge?: 'left' | 'right' | 'top' | 'bottom',
    ): Promise<void> => {
      const workspace = deps.getWorkspace();
      const tab = workspace.tabs[tabId];
      if (tab) void deps.snapshotCoordinator().captureTab(sourcePaneId, tab);
      return updateWorkspace(
        moveWorkspaceTab(workspace, {
          sourcePaneId,
          targetPaneId,
          tabId,
          targetIndex,
          edge,
        }),
      );
    },
    toggleRelay: async (
      setId: string,
      url: string,
      enabled: boolean,
    ): Promise<void> =>
      deps.setRelaySets(await setRelayEnabled(setId, url, enabled)),
    removeRelay: async (setId: string, url: string): Promise<void> =>
      deps.setRelaySets(await removeRelay(setId, url)),
  };
}
