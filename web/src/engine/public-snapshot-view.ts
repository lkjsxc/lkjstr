// Retained public row state and reconciliation; no account or private database access.
import { applyOps } from './ops.ts';
import type { FromEngine, PublicCacheHoldRow, Row } from './protocol.ts';
import {
  type DurableCounts,
  durablePublicRows,
  rememberPublicCounts,
} from './public-snapshot-counts.ts';
import { capturePublicWindow, mergePublicRow } from './public-snapshot-model.ts';
import type { PublicInvalidations } from './public-snapshot-reconcile.ts';
import {
  forgetPublicSnapshot,
  type PublicSnapshot,
  writePublicSnapshot,
} from './public-snapshot-store.ts';

export type PublicView = {
  source: string;
  counts: DurableCounts;
  identity: string;
  rows: readonly Row[];
  allow?: boolean;
  atTop: boolean;
  atBottom: boolean;
  initial: boolean;
  intentTop: boolean;
  reading?: string;
  held?: PublicSnapshot;
  topAnchor?: string;
  received: boolean;
  dirty: boolean;
  suspended?: boolean;
  completed?: boolean;
  invalidations?: PublicInvalidations;
  references?: readonly PublicCacheHoldRow[];
};
export function flushPublicView(view: PublicView): void {
  if (!view.dirty || view.allow !== true || view.held || view.suspended) return;
  view.dirty = false;
  rememberPublicCounts(view.rows, view.counts);
  const capture = (reading?: string): PublicSnapshot | undefined => {
    const window = capturePublicWindow(view.rows, reading, view.atTop, view.atBottom);
    return window ? { ...window, rows: durablePublicRows(window.rows, view.counts) } : undefined;
  };
  const snapshot = capture(view.reading);
  if (!snapshot) {
    if (view.completed && !view.rows.length) forgetPublicSnapshot(view.identity);
    return;
  }
  writePublicSnapshot(view.identity, false, snapshot);
  if (
    view.intentTop ||
    (view.topAnchor &&
      view.rows.find((row) => row.kind === 'note' || row.kind === 'notification')?.key ===
        view.topAnchor)
  ) {
    const top = capture();
    if (top) writePublicSnapshot(view.identity, true, top);
  }
}

export function holdPublicRows(
  sub: string,
  view: PublicView,
  receive: (message: FromEngine) => void,
): boolean {
  const held = view.held;
  if (!held) return false;
  const byKey = new Map(view.rows.map((row) => [row.key, row]));
  const head =
    view.rows.find((row) => row.kind === 'note' || row.kind === 'notification') ?? view.rows[0];
  if (head?.key === held.anchor && held.rows.every((row) => byKey.has(row.key))) {
    view.held = undefined;
    const last = Math.max(
      ...held.rows.map((row) => view.rows.findIndex((next) => next.key === row.key)),
    );
    const keys = new Set(held.rows.map((row) => row.key));
    // Open can answer before the pinned Window: never prepend or interleave its fresh rows.
    view.rows = [
      ...held.rows.map((row) => mergePublicRow(row, byKey.get(row.key) ?? row)),
      ...view.rows.slice(last + 1).filter((row) => !keys.has(row.key)),
    ];
    return false;
  }
  // Startup's empty/partial windows cannot erase a screen the user has already read.
  const updates = held.rows.flatMap((row) => {
    const next = byKey.get(row.key);
    return next ? [{ op: 'update' as const, row: mergePublicRow(row, next) }] : [];
  });
  if (updates.length) {
    view.held = { ...held, rows: applyOps(held.rows, updates) };
    receive({ t: 'patch', sub, ops: updates });
  }
  return true;
}
