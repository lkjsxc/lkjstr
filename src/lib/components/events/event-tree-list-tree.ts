import {
  buildEventTree,
  flattenEventTree,
  type FlatEventTreeItem,
} from '$lib/events/tree';
import type { FeedEvent } from '$lib/events/types';

export type EventTreeListNodeCache = {
  key: string;
  nodes: FlatEventTreeItem[];
};

export function treeNodesFromItems(
  items: readonly FeedEvent[],
  cache: EventTreeListNodeCache,
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
