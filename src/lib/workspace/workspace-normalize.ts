import { findPane, parseLayout } from './layout-tree';
import type { TabGroup } from './tab-group';
import type { WorkspaceTab } from './tab';
import { iconFor, type TabKind } from './tab';
import {
  createEmptyWorkspace,
  ensureUsableWorkspace,
  type Workspace,
} from './workspace';

export function normalizeWorkspace(value: unknown): Workspace {
  const item = value as Partial<Workspace>;
  const base = createEmptyWorkspace();
  const layout = item.layout === null ? null : parseLayout(item.layout);
  const tabGroups = normalizeGroups(item.tabGroups);
  const tabs = normalizeTabs(item.tabs);
  const paneId = stringOrNull(item.focusedPaneId);
  const tabId = item.focusedTabId;
  return ensureUsableWorkspace({
    ...base,
    ...item,
    layout: layout ?? null,
    tabGroups,
    tabs,
    focusedPaneId: layout && paneId && findPane(layout, paneId) ? paneId : null,
    focusedTabId: typeof tabId === 'string' && tabs[tabId] ? tabId : null,
  });
}

function normalizeGroups(value: unknown): Record<string, TabGroup> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, TabGroup> = {};
  for (const [id, group] of Object.entries(value)) {
    const item = group as Partial<TabGroup>;
    if (!Array.isArray(item.tabIds)) continue;
    const tabIds = item.tabIds.filter((tabId) => typeof tabId === 'string');
    const activeTabId = stringOrNull(item.activeTabId);
    out[id] = {
      id,
      tabIds,
      activeTabId:
        activeTabId && tabIds.includes(activeTabId) ? activeTabId : null,
      pinnedTabIds: Array.isArray(item.pinnedTabIds) ? item.pinnedTabIds : [],
      closedTabs: Array.isArray(item.closedTabs) ? item.closedTabs : [],
    };
  }
  return out;
}

function normalizeTabs(value: unknown): Record<string, WorkspaceTab> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, WorkspaceTab> = {};
  for (const [id, tab] of Object.entries(value)) {
    const item = tab as WorkspaceTab & { kind?: unknown };
    const kind = normalizeKind(item.kind);
    if (!kind) continue;
    out[id] = {
      ...item,
      kind,
      icon: iconFor(kind),
      title: normalizedTitle(item.title, kind),
    };
  }
  return out;
}

function normalizeKind(kind: unknown): TabKind | undefined {
  if (kind === 'cache-status') return 'network-stats';
  if (typeof kind !== 'string') return undefined;
  return validKinds.includes(kind as TabKind) ? (kind as TabKind) : undefined;
}

const validKinds: readonly TabKind[] = [
  'welcome',
  'new-tab',
  'timeline',
  'global',
  'notifications',
  'profile',
  'profile-edit',
  'upload-settings',
  'account-manager',
  'npub-miner',
  'thread',
  'relay-monitor',
  'relay-settings',
  'network-stats',
  'search',
  'custom-request',
  'author-context',
  'tweet',
  'settings',
];

function normalizedTitle(title: unknown, kind: TabKind): string {
  if (kind === 'network-stats' && title === 'Cache') return 'Stats';
  return typeof title === 'string' && title ? title : kind;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
