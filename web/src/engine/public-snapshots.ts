// A public rendering cache around the transport; it never reads the event/account database.
import { rememberPublicMedia } from '../shared/public-media.ts';
import type { Transport } from './client-transport.ts';
import { applyOps } from './ops.ts';
import type { Anchor, FromEngine, ToEngine } from './protocol.ts';
import { rememberPublicCounts } from './public-snapshot-counts.ts';
import {
  heldPublicReferences,
  invalidatePublicRow,
  mergePublicRows,
  publicPatchOps,
  reconcilePublicView,
} from './public-snapshot-reconcile.ts';
import {
  forgetPublicSnapshot,
  type PublicSnapshot,
  readPublicSnapshot,
  removePublicSnapshotRows,
  snapshotIdentity,
  withoutPublicRows,
} from './public-snapshot-store.ts';
import {
  flushPublicView as flushView,
  holdPublicRows as heldRows,
  type PublicView as View,
} from './public-snapshot-view.ts';

type WindowMessage = Extract<ToEngine, { t: 'window' }>;
export function publicSnapshots(inner: Transport): Transport {
  const views = new Map<string, View>(); // Same 128-view bound as the Worker.
  let receive: (message: FromEngine) => void = () => {};
  let language = 'en',
    previews = true,
    closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let visible: Set<string> | undefined;
  const flush = (): void => {
    clearTimeout(timer);
    timer = undefined;
    for (const [sub, view] of views) if (!visible || visible.has(sub)) flushView(view);
  };
  const dirty = (view: View): void => {
    view.dirty = true;
    timer ??= setTimeout(flush, 200);
  };
  const replay = (sub: string, view: View, anchor: Anchor): PublicSnapshot | undefined => {
    const snapshot = readPublicSnapshot(view.identity, anchor);
    if (!snapshot) return;
    rememberPublicMedia(snapshot.rows);
    view.held = snapshot;
    rememberPublicCounts(snapshot.rows, view.counts);
    view.references = heldPublicReferences(snapshot.rows);
    inner.post({ t: 'cache.hold', sub, rows: view.references });
    if (anchor === 'top') view.topAnchor = snapshot.anchor;
    queueMicrotask(() => {
      if (closed || views.get(sub) !== view || view.held !== snapshot) return;
      try {
        performance.clearMarks('lkjstr.public-cache');
        performance.mark('lkjstr.public-cache', {
          detail: { sub, source: view.source, rows: snapshot.rows.length },
        });
      } catch {
        /* Optional measurement never delays replay. */
      }
      receive({ t: 'state', sub, state: { phase: 'cache', relaysAsked: 0, relaysAnswered: 0 } });
      receive({
        t: 'rows',
        sub,
        rows: snapshot.rows,
        atTop: snapshot.atTop,
        atBottom: snapshot.atBottom,
      });
    });
    return snapshot;
  };
  inner.listen((message) => {
    if (closed) return;
    const view = 'sub' in message ? views.get(message.sub) : undefined;
    if (message.t === 'cache.reconcile') {
      if (view?.allow === true) {
        const oldAnchor = view.held?.anchor;
        reconcilePublicView(view, message, receive);
        if (view.held && oldAnchor && view.held.anchor !== oldAnchor) {
          if (view.topAnchor === oldAnchor) view.topAnchor = view.held.anchor;
          inner.post({
            t: 'window',
            sub: message.sub,
            anchor: { key: view.held.anchor },
            before: 0,
            after: Math.max(60, view.held.rows.length),
          });
        }
        dirty(view);
      }
      return;
    }
    if (message.t === 'cache.policy') {
      if (!view) return;
      if (!message.allow) {
        forgetPublicSnapshot(view.identity);
        view.rows = [];
        view.counts.clear();
        view.held = undefined;
        view.dirty = false;
      } else if (view.allow !== true) view.rows = [];
      view.allow = message.allow;
      receive(message);
      return;
    }
    if (message.t === 'rows' && view) {
      view.received = true;
      if (view.allow === true) {
        view.rows = mergePublicRows(view, message.rows);
        if (view.intentTop)
          view.topAnchor ??= view.rows.find(
            (row) => row.kind === 'note' || row.kind === 'notification',
          )?.key;
        view.atTop = message.atTop;
        view.atBottom = message.atBottom;
        rememberPublicMedia(view.rows);
        rememberPublicCounts(view.rows, view.counts);
        if (heldRows(message.sub, view, receive)) return;
        dirty(view);
        receive({ ...message, rows: view.rows });
        return;
      }
      // An older/denying engine remains authoritative; no new snapshot is retained.
      view.held = undefined;
    } else if (message.t === 'patch' && view && view.allow === true) {
      const ops = publicPatchOps(view, message.ops);
      for (const op of ops) {
        if (op.op === 'update') rememberPublicCounts([op.row], view.counts);
        else if (op.op === 'insert') rememberPublicCounts(op.rows, view.counts);
      }
      view.rows = applyOps(view.rows, ops)
        .slice(0, 6400)
        .map((row) => invalidatePublicRow(row, view.invalidations));
      rememberPublicMedia(view.rows);
      const removals = ops.filter((op) => op.op === 'remove');
      const removed = new Set(removals.map((op) => op.key));
      removePublicSnapshotRows(view.identity, removed);
      if (view.held) {
        if (removals.length) {
          const oldAnchor = view.held.anchor;
          view.held = withoutPublicRows(view.held, removed);
          receive({ ...message, ops: removals });
          if (view.held && view.held.anchor !== oldAnchor) {
            if (view.topAnchor === oldAnchor) view.topAnchor = view.held.anchor;
            inner.post({
              t: 'window',
              sub: message.sub,
              anchor: { key: view.held.anchor },
              before: 0,
              after: Math.max(60, view.held.rows.length),
            });
          }
        }
        if (heldRows(message.sub, view, receive)) return;
        receive({
          t: 'rows',
          sub: message.sub,
          rows: view.rows,
          atTop: view.atTop,
          atBottom: view.atBottom,
        });
      } else receive({ ...message, ops });
      if (ops.some((op) => op.op === 'remove') && !view.rows.length && !view.held)
        view.completed = true;
      dirty(view);
      return;
    } else if (
      message.t === 'state' &&
      view?.allow === true &&
      message.state.phase === 'done' &&
      message.state.relaysAnswered > 0
    ) {
      view.completed = true;
      // EOSE says the relay is finished, not that a stored public event was deleted.
      if (!view.held) dirty(view);
    }
    receive(message);
  });
  window.addEventListener('pagehide', flush);
  return {
    post(message, transfer) {
      if (closed) return;
      if (message.t === 'configure') {
        const changed =
          language !== message.config.language ||
          previews !== (message.config.linkPreviews !== false);
        if (changed)
          for (const view of views.values()) {
            flushView(view);
            // Configure has no generation acknowledgement. Capture resumes on a fresh Open.
            view.suspended = true;
            view.held = undefined;
            view.dirty = false;
          }
        language = message.config.language;
        previews = message.config.linkPreviews !== false;
      } else if (message.t === 'hint') {
        visible = new Set(message.hint.visibleSubs);
        if (message.hint.pageHidden) flush();
      } else if (message.t === 'open' && (views.has(message.sub) || views.size < 128)) {
        const view: View = {
          source: message.query.source,
          counts: new Map(),
          identity: snapshotIdentity(message.query, language, previews),
          rows: [],
          atTop: true,
          atBottom: false,
          initial: true,
          intentTop: true,
          received: false,
          dirty: false,
        };
        views.set(message.sub, view);
        queueMicrotask(() => {
          if (closed || views.get(message.sub) !== view || !view.initial || view.received) return;
          view.initial = false;
          const snapshot = replay(message.sub, view, 'top');
          if (snapshot)
            inner.post({
              t: 'window',
              sub: message.sub,
              anchor: { key: snapshot.anchor },
              before: 0,
              after: Math.max(60, snapshot.rows.length),
            });
        });
      } else if (message.t === 'window') {
        const view = views.get(message.sub);
        if (view) {
          const anchor = message.anchor;
          flushView(view);
          view.intentTop = message.anchor === 'top';
          view.liveAbove = message.liveAbove;
          if (view.initial) {
            view.initial = false;
            const snapshot = view.received ? undefined : replay(message.sub, view, message.anchor);
            if (snapshot) {
              const pinned: WindowMessage = {
                ...message,
                anchor: message.liveAbove ? anchor : { key: snapshot.anchor },
                before: message.liveAbove ? message.before : 0,
                after: Math.max(message.after, snapshot.rows.length),
              };
              inner.post(pinned, transfer);
              return;
            }
          } else if (
            anchor === 'top' ||
            'at' in anchor ||
            ('key' in anchor && !view.held?.rows.some((row) => row.key === anchor.key))
          ) {
            view.held = undefined;
            if (message.anchor === 'top') {
              view.topAnchor = undefined;
              view.rows = [];
              view.counts.clear();
            }
          }
        }
      } else if (message.t === 'reading') {
        const view = views.get(message.sub);
        if (view) {
          view.reading = message.key ?? undefined;
          dirty(view);
        }
      } else if (message.t === 'close') {
        const view = views.get(message.sub);
        if (view) flushView(view);
        views.delete(message.sub);
      }
      inner.post(message, transfer);
    },
    listen(fn) {
      receive = fn;
    },
    close() {
      if (closed) return;
      flush();
      closed = true;
      clearTimeout(timer);
      window.removeEventListener('pagehide', flush);
      views.clear();
      inner.close();
    },
  };
}
