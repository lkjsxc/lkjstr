import { tick } from 'svelte';
import {
  captureVirtualAnchor,
  restoreVirtualAnchor,
  type VirtualListHandle,
} from '$lib/events/scroll-anchor';
import type { FlatEventTreeItem } from '$lib/events/tree';
import {
  setTabFeedAnchor,
  type TabFeedAnchor,
} from '$lib/workspace/tab-anchor-registry';

export type EventAnchorRow = {
  readonly node: FlatEventTreeItem;
  readonly visualIndex: number;
};

export type TreeListAnchorHandle = VirtualListHandle & {
  getViewportSize?: () => number;
  getScrollSize?: () => number;
};

export async function restoreFeedListAnchor(args: {
  readonly restore?: { readonly anchorKey: string; readonly offset: number };
  readonly rows: readonly EventAnchorRow[];
  readonly list?: TreeListAnchorHandle;
  readonly key: (node: FlatEventTreeItem) => string;
  readonly destroyed: () => boolean;
  readonly restoredKey: string;
}): Promise<string> {
  const restore = args.restore;
  if (!restore || !args.list?.scrollTo) return args.restoredKey;
  const key = `${restore.anchorKey}:${restore.offset}`;
  if (args.restoredKey === key) return key;
  await tick();
  if (!args.destroyed())
    restoreVirtualAnchor(
      { key: restore.anchorKey, offset: restore.offset },
      args.rows,
      (row) => args.key(row.node),
      visualIndexList(args.rows, args.list),
    );
  return key;
}

export function syncFeedListAnchor(args: {
  readonly tabId?: string;
  readonly previous: readonly EventAnchorRow[];
  readonly rows: readonly EventAnchorRow[];
  readonly list?: TreeListAnchorHandle;
  readonly key: (node: FlatEventTreeItem) => string;
  readonly destroyed: () => boolean;
}): { readonly rows: EventAnchorRow[]; readonly anchor?: TabFeedAnchor } {
  const atTop = feedListOffset(args.list) <= 1;
  const anchor = captureFeedListAnchor(args.previous, args.list, args.key);
  if (args.tabId && anchor) setTabFeedAnchor(args.tabId, anchor);
  void tick().then(() => {
    if (args.destroyed()) return;
    if (atTop && !anchor) {
      if (feedListOffset(args.list) > 1) args.list?.scrollTo?.(0);
      return;
    }
    restoreVirtualAnchor(
      anchor ? { key: anchor.anchorKey, offset: anchor.offset } : undefined,
      args.rows,
      (row) => args.key(row.node),
      visualIndexList(args.rows, args.list),
    );
  });
  return { rows: [...args.rows], anchor };
}

export function captureFeedListAnchor(
  rows: readonly EventAnchorRow[],
  list: TreeListAnchorHandle | undefined,
  key: (node: FlatEventTreeItem) => string,
): TabFeedAnchor | undefined {
  const anchor = captureVirtualAnchor(
    rows,
    (row) => key(row.node),
    visualIndexList(rows, list),
  );
  return anchor ? { anchorKey: anchor.key, offset: anchor.offset } : undefined;
}

export function captureAndStoreFeedListAnchor(args: {
  readonly tabId?: string;
  readonly rows: readonly EventAnchorRow[];
  readonly list?: TreeListAnchorHandle;
  readonly key: (node: FlatEventTreeItem) => string;
}): void {
  if (!args.tabId) return;
  const anchor = captureFeedListAnchor(args.rows, args.list, args.key);
  if (anchor) setTabFeedAnchor(args.tabId, anchor);
}

function feedListOffset(list?: TreeListAnchorHandle): number {
  return list?.getScrollOffset?.() ?? list?.getOffset?.() ?? 0;
}

function visualIndexList(
  rows: readonly EventAnchorRow[],
  list?: TreeListAnchorHandle,
): TreeListAnchorHandle | undefined {
  if (!list) return undefined;
  return {
    ...list,
    getItemOffset: (index) =>
      list.getItemOffset?.(rows[index]?.visualIndex ?? index) ?? index,
  };
}
