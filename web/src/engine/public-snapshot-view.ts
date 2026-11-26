// Retained public row state and reconciliation; no account or private database access.
import { applyOps } from './ops.ts';
import type { Anchor, FromEngine, PublicCacheHoldRow, Row, ToEngine } from './protocol.ts';
import {
  type DurableCounts,
  durablePublicRows,
  rememberPublicCounts,
} from './public-snapshot-counts.ts';
import { capturePublicWindow, mergePublicRow } from './public-snapshot-model.ts';
import type { PublicInvalidations } from './public-snapshot-reconcile.ts';
import {
  forgetPublicSnapshot,
  hasAbsoluteReadingTime,
  type PublicSnapshot,
  type SnapshotWindow,
  snapshotRows,
  writePublicSnapshot,
} from './public-snapshot-store.ts';

export type PublicView = {
  source: string;
  counts: DurableCounts;
  identity: string;
  rows: readonly Row[];
  allow?: boolean;
  snapshotWindow?: SnapshotWindow;
  atTop: boolean;
  atBottom: boolean;
  initial: boolean;
  intentTop: boolean;
  liveAbove?: boolean;
  reading?: string;
  held?: PublicSnapshot;
  topAnchor?: string;
  received: boolean;
  dirty: boolean;
  windowScope?: 'absolute' | 'returning';
  suspended?: boolean;
  completed?: boolean;
  invalidations?: PublicInvalidations;
  references?: readonly PublicCacheHoldRow[];
};

type WindowMessage = Extract<ToEngine, { t: 'window' }>;
export function preparePublicWindow(
  view: PublicView,
  message: WindowMessage,
  replay: (anchor: Anchor) => PublicSnapshot | undefined,
): WindowMessage {
  const { anchor } = message;
  flushPublicView(view);
  view.intentTop = anchor === 'top';
  view.liveAbove = message.liveAbove;
  const absolute = anchor !== 'top' && 'at' in anchor;
  if (absolute || view.windowScope === 'absolute') {
    // This query identity has only ordinary snapshots. Wait for new rows on the way back.
    view.windowScope = absolute ? 'absolute' : 'returning';
    view.initial = false;
    view.held = undefined;
    view.rows = [];
    view.counts.clear();
    view.reading = view.topAnchor = undefined;
    view.completed = view.dirty = false;
  } else if (view.initial) {
    view.initial = false;
    const snapshot = view.received ? undefined : replay(anchor);
    if (snapshot)
      return {
        ...message,
        anchor: message.liveAbove ? anchor : { key: snapshot.anchor },
        before: message.liveAbove ? message.before : 0,
        after: Math.max(message.after, snapshot.rows.length),
      };
  } else if (
    anchor === 'top' ||
    ('key' in anchor && !view.held?.rows.some((row) => row.key === anchor.key))
  ) {
    view.held = undefined;
    if (anchor === 'top') {
      view.topAnchor = undefined;
      view.rows = [];
      view.counts.clear();
    }
  }
  return message;
}

export function tracksPublicWindow(view: PublicView, message: FromEngine): boolean {
  if (view.windowScope === 'absolute') return false;
  const absoluteRows =
    (message.t === 'rows' && message.rows.some(hasAbsoluteReadingTime)) ||
    (message.t === 'patch' &&
      message.ops.some((op) => {
        if (op.op === 'insert') return op.rows.some(hasAbsoluteReadingTime);
        return op.op === 'update' && hasAbsoluteReadingTime(op.row);
      }));
  if (absoluteRows) {
    // A delayed pivot batch can arrive after an empty window on the way back.
    view.windowScope = 'returning';
    view.completed = false;
    return false;
  }
  if (message.t === 'rows') view.windowScope = undefined;
  return view.windowScope === undefined;
}

export function flushPublicView(view: PublicView): void {
  if (!view.dirty || view.allow !== true || view.held || view.suspended || view.windowScope) return;
  view.dirty = false;
  rememberPublicCounts(view.rows, view.counts);
  const rows = snapshotRows(view.rows, view.snapshotWindow);
  const capture = (reading?: string): PublicSnapshot | undefined => {
    const window = capturePublicWindow(
      rows,
      reading,
      view.atTop,
      view.atBottom && rows.length === view.rows.length,
    );
    return window
      ? {
          ...window,
          rows: durablePublicRows(window.rows, view.counts),
          window: view.snapshotWindow,
        }
      : undefined;
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
  if (
    (view.liveAbove || head?.key === held.anchor) &&
    held.rows.every((row) => byKey.has(row.key))
  ) {
    view.held = undefined;
    if (view.liveAbove) {
      const painted = new Map(held.rows.map((row) => [row.key, row]));
      view.rows = view.rows.map((row) => mergePublicRow(painted.get(row.key) ?? row, row));
      return false;
    }
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

export function markPublicReplay(sub: string, source: string, rows: number): void {
  try {
    performance.clearMarks('lkjstr.public-cache');
    performance.mark('lkjstr.public-cache', { detail: { sub, source, rows } });
  } catch {
    // Optional measurement never delays replay.
  }
}
