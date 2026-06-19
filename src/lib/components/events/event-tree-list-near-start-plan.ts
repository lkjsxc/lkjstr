import type { EventTreeListViewRow } from './event-tree-list-helpers';

export function nearStartVisualIndex(
  rows: readonly EventTreeListViewRow[],
): number | undefined {
  const index = rows.findIndex(
    (row) =>
      (row.kind === 'leading' && row.row.nearStart === true) ||
      row.kind === 'event' ||
      row.kind === 'eventFragment',
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
