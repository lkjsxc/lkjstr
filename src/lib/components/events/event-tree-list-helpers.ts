import {
  buildEventTree,
  flattenEventTree,
  type FlatEventTreeItem,
} from '$lib/events/tree';
import type { FeedEvent } from '$lib/events/types';
import type { HistoryExhaustion } from '$lib/feed-surface/paging-state';

export type EventTreeListLeadingRow = {
  readonly key: string;
  readonly nearStart?: boolean;
};

export type EventTreeListViewRow =
  | { readonly kind: 'leading'; readonly row: EventTreeListLeadingRow }
  | {
      readonly kind: 'event';
      readonly node: FlatEventTreeItem;
      readonly visualIndex: number;
    }
  | { readonly kind: 'loadingOlder' }
  | { readonly kind: 'terminal' }
  | { readonly kind: 'empty'; readonly text: string };

export function buildViewRows(
  leadingRows: readonly EventTreeListLeadingRow[],
  nodes: readonly FlatEventTreeItem[],
  loadingOlder: boolean,
  hasOlder: boolean | undefined,
  historyExhaustion: HistoryExhaustion | undefined,
  loading: boolean | undefined,
  emptyText: string,
): EventTreeListViewRow[] {
  const rows: EventTreeListViewRow[] = leadingRows.map((row) => ({
    kind: 'leading',
    row,
  }));
  rows.push(
    ...nodes.map((node, index) => ({
      kind: 'event' as const,
      node,
      visualIndex: leadingRows.length + index,
    })),
  );
  if (nodes.length === 0 && !loading)
    rows.push({ kind: 'empty', text: emptyText });
  if (loadingOlder && hasOlder) return [...rows, { kind: 'loadingOlder' }];
  if (historyExhaustion === 'proven' && nodes.length > 0)
    return [...rows, { kind: 'terminal' }];
  return rows;
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

export function eventRows(
  rows: readonly EventTreeListViewRow[],
): { readonly node: FlatEventTreeItem; readonly visualIndex: number }[] {
  return rows
    .filter((row) => row.kind === 'event')
    .map((row) => ({ node: row.node, visualIndex: row.visualIndex }));
}

export function nearStartVisualIndex(
  rows: readonly EventTreeListViewRow[],
): number | undefined {
  const index = rows.findIndex(
    (row) =>
      (row.kind === 'leading' && row.row.nearStart === true) ||
      row.kind === 'event',
  );
  return index >= 0 ? index : undefined;
}

export function isRowNearStart(
  rows: readonly EventTreeListViewRow[],
  offset: number,
  getItemOffset: (index: number) => number | undefined,
  isNear: (offset: number) => boolean,
): boolean {
  const index = nearStartVisualIndex(rows);
  if (index === undefined) return false;
  const targetOffset = getItemOffset(index) ?? index;
  return offset >= targetOffset && isNear(offset - targetOffset);
}

export function viewRowKey(row: EventTreeListViewRow): string {
  if (row.kind === 'leading') return `event-list-leading-${row.row.key}`;
  if (row.kind === 'terminal') return 'event-list-terminal';
  if (row.kind === 'loadingOlder') return 'event-list-loading-older';
  if (row.kind === 'empty') return 'event-list-empty';
  return row.node.event.id;
}
