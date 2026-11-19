import type { Row } from '../engine/protocol.ts';

/** Search suggestions precede a note window; they never consume its note budget. */
export function feedWindow(kind: string, rows: readonly Row[]) {
  let start = rows[0]?.kind === 'profile' || rows[0]?.kind === 'channel' ? 1 : 0;
  if (kind === 'search') while (start < rows.length && rows[start]?.kind === 'person') start++;
  return {
    first: rows[start]?.key,
    last: start < rows.length ? rows.at(-1)?.key : undefined,
    count: rows.length - start,
  };
}

export function freshRows(rows: readonly Row[], boundary: string, reading: string | undefined) {
  if (!rows.some((row) => row.key === boundary)) return;
  let count = 0;
  for (const row of rows) {
    if (row.key === boundary || row.key === reading) break;
    if (row.kind === 'note' || row.kind === 'notification') count++;
  }
  return count;
}
