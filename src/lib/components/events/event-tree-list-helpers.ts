import {
  buildEventTree,
  flattenEventTree,
  type FlatEventTreeItem,
} from '$lib/events/tree';
import type { FeedEvent } from '$lib/events/types';
import type { ViewRow } from './EventTreeListRows.svelte';

export function buildViewRows(
  nodes: readonly FlatEventTreeItem[],
  loadingOlder: boolean,
  hasOlder: boolean | undefined,
): ViewRow[] {
  if (loadingOlder && hasOlder) return [...nodes, { loadingOlder: true }];
  if (hasOlder === false && nodes.length > 0)
    return [...nodes, { terminal: true }];
  return [...nodes];
}

export function treeNodesFromItems(
  items: readonly FeedEvent[],
  cache: { key: string; nodes: FlatEventTreeItem[] },
): FlatEventTreeItem[] {
  const key = items.map((item) => item.event.id).join('\u0000');
  if (key === cache.key) return cache.nodes;
  cache.key = key;
  cache.nodes = flattenEventTree(buildEventTree(items));
  return cache.nodes;
}

export function eventNodeKey(node: FlatEventTreeItem): string {
  return node.event.id;
}

export function viewRowKey(row: ViewRow): string {
  if ('terminal' in row) return 'event-list-terminal';
  if ('loadingOlder' in row) return 'event-list-loading-older';
  return row.event.id;
}
