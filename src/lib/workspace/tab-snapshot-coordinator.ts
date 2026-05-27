import { countRuntime } from '../app/runtime-counters';
import { clearRuntimeSnapshot } from './tab-runtime-registry';
import type { TabGroup } from './tab-group';
import type { PaneScrollRetention } from './pane-scroll-retention';
import { createPaneScrollRetention } from './pane-scroll-retention';
import { createSessionTabSnapshots } from './session-tab-snapshots';
import type { WorkspaceTab } from './tab';
import type { TabSnapshotPayload, TabSnapshotRestore } from './tab-snapshot';
import {
  feedAnchorFromPayload,
  loadPersistedTabSnapshot,
  loadPersistedTabSnapshots,
  snapshotPayloadForTab,
} from './tab-snapshot-persist';
import {
  deleteMissingTabStates,
  deleteTabState,
  saveTabState,
} from './tab-states-store';

type TabSnapshot = TabSnapshotPayload & { readonly id: string };
type PreCaptureHook = (tabId: string) => void | Promise<void>;
type FieldProvider = (tabId: string) => Record<string, string> | undefined;

export type TabSnapshotCoordinator = ReturnType<
  typeof createTabSnapshotCoordinator
>;

export function createTabSnapshotCoordinator(args: {
  readonly workspaceId: string;
  readonly inactiveRetentionSeconds: number;
}) {
  const bodyScroll = createPaneScrollRetention();
  const warm = createSessionTabSnapshots<TabSnapshot>();
  const restores = new Map<string, TabSnapshotRestore>();
  const preCaptureHooks = new Set<PreCaptureHook>();
  const fieldProviders = new Set<FieldProvider>();
  let retentionSeconds = args.inactiveRetentionSeconds;

  const token = (): string => crypto.randomUUID();
  const rememberRestore = (
    tabId: string,
    payload: TabSnapshotPayload | undefined,
  ): TabSnapshotPayload | undefined => {
    if (!payload) return undefined;
    restores.set(tabId, { token: token(), payload });
    return payload;
  };
  const payloadWithFields = (
    tabId: string,
    payload: TabSnapshotPayload,
  ): TabSnapshotPayload => {
    if (payload.kind !== 'tool') return payload;
    const fields = Object.assign(
      {},
      ...[...fieldProviders].map((provider) => provider(tabId) ?? {}),
    );
    return Object.keys(fields).length
      ? { ...payload, fields: { ...payload.fields, ...fields } }
      : payload;
  };
  const runPreCapture = async (tabId: string): Promise<void> => {
    for (const hook of preCaptureHooks) await hook(tabId);
  };

  async function captureTab(
    paneId: string | undefined,
    tab: WorkspaceTab,
  ): Promise<TabSnapshotPayload> {
    await runPreCapture(tab.id);
    bodyScroll.remember(tab.id);
    const scrollTop = bodyScroll.snapshot(tab.id).scrollTop ?? 0;
    const saved = payloadWithFields(
      tab.id,
      snapshotPayloadForTab(tab, scrollTop),
    );
    await saveTabState(args.workspaceId, paneId, tab.id, saved);
    if (retentionSeconds > 0)
      warm.retain({ id: tab.id, ...saved }, retentionSeconds);
    countRuntime('tab-snapshot-durable-save', 'events');
    return saved;
  }

  async function restoreTab(
    tabId: string,
  ): Promise<TabSnapshotPayload | undefined> {
    const hadLiveScroll = bodyScroll.hasRememberedScroll(tabId);
    const session = warm.take(tabId);
    const payload =
      session ??
      (await loadPersistedTabSnapshot(args.workspaceId, tabId).then(
        (loaded) => {
          if (loaded) countRuntime('tab-snapshot-durable-load', 'events');
          return loaded;
        },
      ));
    if (payload) {
      clearRuntimeSnapshot(tabId);
      rememberRestore(tabId, payload);
      if (!hadLiveScroll && payload.scrollTop !== undefined)
        bodyScroll.restoreSnapshot(tabId, { scrollTop: payload.scrollTop });
    }
    if (!hadLiveScroll) bodyScroll.restore(tabId);
    return payload;
  }

  return {
    trackBody: (tabId: string, node: HTMLElement) =>
      bodyScroll.track(tabId, node),
    rememberScroll: (tabId: string) => bodyScroll.remember(tabId),
    restoreRecords: (): Record<string, TabSnapshotRestore> =>
      Object.fromEntries(restores.entries()),
    setRetentionSeconds: (seconds: number): void => {
      if (seconds === retentionSeconds) return;
      warm.releaseAll('retention-disabled');
      retentionSeconds = seconds;
    },
    registerPreCapture: (hook: PreCaptureHook): (() => void) => {
      preCaptureHooks.add(hook);
      return () => preCaptureHooks.delete(hook);
    },
    registerFieldProvider: (provider: FieldProvider): (() => void) => {
      fieldProviders.add(provider);
      return () => fieldProviders.delete(provider);
    },
    consumeRestore: (tabId: string, restore?: TabSnapshotRestore): void => {
      if (!restore) return;
      if (restores.get(tabId)?.token === restore.token) {
        restores.delete(tabId);
        countRuntime('tab-snapshot-restore-consume', 'events');
      } else countRuntime('tab-snapshot-stale-restore-ignore', 'events');
    },
    restoreAnchor: (tabId: string) =>
      feedAnchorFromPayload(restores.get(tabId)?.payload),
    restoreTab,
    captureTab,
    syncFocus: async (input: {
      readonly paneId: string;
      readonly active?: WorkspaceTab;
      readonly previousActiveId?: string;
      readonly tabs: Record<string, WorkspaceTab>;
      readonly group?: TabGroup;
    }): Promise<void> => {
      if (input.active) await restoreTab(input.active.id);
      const previous = input.previousActiveId
        ? input.tabs[input.previousActiveId]
        : undefined;
      if (
        previous &&
        previous.id !== input.active?.id &&
        input.group?.tabIds.includes(previous.id)
      )
        await captureTab(input.paneId, previous);
    },
    loadTabs: async (tabIds: readonly string[]): Promise<void> => {
      const loaded = await loadPersistedTabSnapshots(args.workspaceId, tabIds);
      if (Object.keys(loaded).length > 0)
        countRuntime('tab-snapshot-durable-load', 'events');
      for (const [tabId, payload] of Object.entries(loaded)) {
        rememberRestore(tabId, payload);
        if (payload.scrollTop !== undefined)
          bodyScroll.restoreSnapshot(tabId, { scrollTop: payload.scrollTop });
      }
    },
    deleteTab: async (tabId: string): Promise<void> => {
      warm.release(tabId, 'tab-removed');
      clearRuntimeSnapshot(tabId);
      restores.delete(tabId);
      await deleteTabState(args.workspaceId, tabId);
      countRuntime('tab-snapshot-cleanup', 'events');
    },
    cleanup: async (validTabIds: ReadonlySet<string>): Promise<void> => {
      warm.releaseMissing(validTabIds);
      for (const tabId of [...restores.keys()])
        if (!validTabIds.has(tabId)) restores.delete(tabId);
      await deleteMissingTabStates(args.workspaceId, validTabIds);
      countRuntime('tab-snapshot-cleanup', 'events');
    },
    releaseAll: () => warm.releaseAll('pane-destroyed'),
    bodyScrollForTests: (): PaneScrollRetention => bodyScroll,
  };
}
