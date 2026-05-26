import { tick } from 'svelte';
import {
  captureVirtualAnchor,
  restoreVirtualAnchor,
  type VirtualListHandle,
} from '$lib/events/scroll-anchor';
import type { FlatEventTreeItem } from '$lib/events/tree';
import { setTabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

export type TreeListAnchorHandle = VirtualListHandle & {
  getViewportSize?: () => number;
  getScrollSize?: () => number;
};

export async function restoreFeedListAnchor(args: {
  readonly restore?: { readonly eventId: string; readonly offset: number };
  readonly nodes: readonly FlatEventTreeItem[];
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
      args.nodes,
      args.key,
      args.list,
    );
  return key;
}

export function syncFeedListAnchor(args: {
  readonly tabId?: string;
  readonly previous: readonly FlatEventTreeItem[];
  readonly nodes: readonly FlatEventTreeItem[];
  readonly list?: TreeListAnchorHandle;
  readonly key: (node: FlatEventTreeItem) => string;
  readonly destroyed: () => boolean;
}): FlatEventTreeItem[] {
  const anchor = captureVirtualAnchor(args.previous, args.key, args.list);
  if (args.tabId && anchor)
    setTabFeedAnchor(args.tabId, {
      eventId: anchor.key,
      offset: anchor.offset,
    });
  void tick().then(() => {
    if (!args.destroyed())
      restoreVirtualAnchor(anchor, args.nodes, args.key, args.list);
  });
  return [...args.nodes];
}
