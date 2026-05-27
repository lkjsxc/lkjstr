import { tick } from 'svelte';
import {
  captureVirtualAnchor,
  restoreVirtualAnchor,
  type VirtualListHandle,
} from '$lib/events/scroll-anchor';
import type { FlatEventTreeItem } from '$lib/events/tree';
import { setTabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

export type EventAnchorRow = {
  readonly node: FlatEventTreeItem;
  readonly visualIndex: number;
};

export type TreeListAnchorHandle = VirtualListHandle & {
  getViewportSize?: () => number;
  getScrollSize?: () => number;
};

export async function restoreFeedListAnchor(args: {
  readonly restore?: { readonly eventId: string; readonly offset: number };
  readonly rows: readonly EventAnchorRow[];
  readonly list?: TreeListAnchorHandle;
  readonly key: (node: FlatEventTreeItem) => string;
  readonly destroyed: () => boolean;
  readonly restoredKey: string;
}): Promise<string> {
  const restore = args.restore;
  if (!restore || !args.list?.scrollTo) return args.restoredKey;
  const key = `${restore.eventId}:${restore.offset}`;
  if (args.restoredKey === key) return key;
  await tick();
  if (!args.destroyed())
    restoreVirtualAnchor(
      { key: restore.eventId, offset: restore.offset },
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
}): EventAnchorRow[] {
  const anchor = captureVirtualAnchor(
    args.previous,
    (row) => args.key(row.node),
    visualIndexList(args.previous, args.list),
  );
  if (args.tabId && anchor)
    setTabFeedAnchor(args.tabId, {
      eventId: anchor.key,
      offset: anchor.offset,
    });
  void tick().then(() => {
    if (!args.destroyed())
      restoreVirtualAnchor(
        anchor,
        args.rows,
        (row) => args.key(row.node),
        visualIndexList(args.rows, args.list),
      );
  });
  return [...args.rows];
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
