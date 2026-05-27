import type { FeedScrollListHandle } from '$lib/components/feed/FeedScrollSurface.svelte';
import type { FlatEventTreeItem } from '$lib/events/tree';
import type { EventTreeListViewRow } from './event-tree-list-helpers';

const fallbackPinLimit = 80;

export function nearVisibleEventIds(
  rows: readonly EventTreeListViewRow[],
  list: FeedScrollListHandle | undefined,
  scrollOffset: number,
): string[] {
  const viewport = list?.getViewportSize?.() ?? 0;
  const getOffset = list?.getItemOffset;
  if (!getOffset || viewport <= 0) return fallbackIds(rows);
  const start = Math.max(0, scrollOffset - viewport);
  const end = scrollOffset + viewport * 2;
  return rows
    .flatMap((row, index) => {
      if (row.kind !== 'event') return [];
      const offset = getOffset(index);
      return offset === undefined || (offset >= start && offset <= end)
        ? [row.node.event.id]
        : [];
    })
    .slice(0, fallbackPinLimit);
}

export function fallbackNodeIds(nodes: readonly FlatEventTreeItem[]): string[] {
  return nodes.slice(0, fallbackPinLimit).map((node) => node.event.id);
}

function fallbackIds(rows: readonly EventTreeListViewRow[]): string[] {
  return rows
    .flatMap((row) => (row.kind === 'event' ? [row.node.event.id] : []))
    .slice(0, fallbackPinLimit);
}
