import type { Row } from '../engine/protocol.ts';

/** Search suggestions precede a note window; they never consume its note budget. */
export function feedWindow(kind: string, rows: readonly Row[]) {
  let start = ['profile', 'channel', 'relay'].includes(rows[0]?.kind ?? '') ? 1 : 0;
  if (kind === 'search') while (start < rows.length && rows[start]?.kind === 'person') start++;
  return {
    first: rows[start]?.key,
    last: start < rows.length ? rows.at(-1)?.key : undefined,
    count: rows.length - start,
  };
}

function freshRows(rows: readonly Row[], boundary: string, reading: string | undefined) {
  if (!rows.some((row) => row.key === boundary)) return;
  let count = 0;
  for (const row of rows) {
    if (row.key === boundary || row.key === reading) break;
    if (row.kind === 'note' || row.kind === 'notification') count++;
  }
  return count;
}

export function heldFresh(
  rows: readonly Row[],
  boundary: string | undefined,
  reading: string | undefined,
  outside: { count: number },
  outsideBaseline: number | undefined,
) {
  const above = outside.count;
  if (!boundary) return { count: above, more: false };
  const count = freshRows(rows, boundary, reading);
  const more = above > (count === undefined ? (outsideBaseline ?? above) : 0);
  return { count: (more ? freshRows(rows, boundary, undefined) : count) ?? 0, more };
}

export function isOwnNote(row: Row | undefined): boolean {
  return row?.kind === 'note' && row.mine.own;
}
