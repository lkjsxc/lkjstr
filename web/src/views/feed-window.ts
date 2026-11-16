import type { Row } from '../engine/protocol.ts';

/** Search suggestions precede a note window; they never consume its note budget. */
export function feedWindow(kind: string, rows: readonly Row[]) {
  let start = 0;
  if (kind === 'search') while (start < rows.length && rows[start]?.kind === 'person') start++;
  return {
    first: rows[start]?.key,
    last: start < rows.length ? rows.at(-1)?.key : undefined,
    count: rows.length - start,
  };
}
