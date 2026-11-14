// Applying the engine's patches to the rows of a window. Pure: the feed keeps the result and draws it.
import type { PatchOp, Row } from './protocol.ts';

export function applyOps(rows: readonly Row[], ops: readonly PatchOp[]): Row[] {
  const out = [...rows];
  for (const op of ops) {
    if (op.op === 'insert') {
      const fresh = op.rows.filter((r) => !out.some((x) => x.key === r.key));
      const at = op.before === null ? -1 : out.findIndex((r) => r.key === op.before);
      out.splice(at < 0 ? out.length : at, 0, ...fresh);
    } else if (op.op === 'update') {
      const i = out.findIndex((r) => r.key === op.row.key);
      if (i >= 0) out[i] = op.row;
    } else {
      const i = out.findIndex((r) => r.key === op.key);
      if (i >= 0) out.splice(i, 1);
    }
  }
  return out;
}
