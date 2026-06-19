import type { FlatEventTreeItem } from '$lib/events/tree';
import type { HistoryExhaustion } from '$lib/feed-surface/paging-state';
import {
  planEventVisualFragments,
  type FeedVisualFragment,
} from '$lib/feed-surface/feed-visual-fragments';

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
  | {
      readonly kind: 'eventFragment';
      readonly node: FlatEventTreeItem;
      readonly fragment: FeedVisualFragment;
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
  for (const node of nodes) {
    if ('collapsed' in node) {
      rows.push({ kind: 'event', node, visualIndex: rows.length });
      continue;
    }
    const fragments = planEventVisualFragments(node);
    if (fragments.length === 1 && fragments[0]?.kind === 'event-full') {
      rows.push({ kind: 'event', node, visualIndex: rows.length });
      continue;
    }
    for (const fragment of fragments) {
      rows.push({
        kind: 'eventFragment',
        node,
        fragment,
        visualIndex: rows.length,
      });
    }
  }
  if (nodes.length === 0 && !loading)
    rows.push({ kind: 'empty', text: emptyText });
  if (loadingOlder && hasOlder) return [...rows, { kind: 'loadingOlder' }];
  if (historyExhaustion === 'proven' && nodes.length > 0)
    return [...rows, { kind: 'terminal' }];
  return rows;
}

export function eventRows(rows: readonly EventTreeListViewRow[]): {
  readonly node: FlatEventTreeItem;
  readonly visualIndex: number;
  readonly rowKey?: string;
}[] {
  return rows
    .filter((row) => row.kind === 'event' || row.kind === 'eventFragment')
    .map((row) => ({
      node: row.node,
      visualIndex: row.visualIndex,
      rowKey: row.kind === 'eventFragment' ? row.fragment.rowKey : undefined,
    }));
}

export function viewRowKey(row: EventTreeListViewRow): string {
  if (row.kind === 'leading') return `event-list-leading-${row.row.key}`;
  if (row.kind === 'terminal') return 'event-list-terminal';
  if (row.kind === 'loadingOlder') return 'event-list-loading-older';
  if (row.kind === 'empty') return 'event-list-empty';
  if (row.kind === 'eventFragment') return row.fragment.rowKey;
  return row.node.event.id;
}
