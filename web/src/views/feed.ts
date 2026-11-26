import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Anchor, Query, Row, SubState } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { ability } from './can.ts';
import { mountChannelDesk } from './channel-desk.ts';
import { mountFeedBar } from './feed-bar.ts';
import { createRowList, type ListRow } from './feed-draw.ts';
import { createFresh } from './feed-fresh.ts';
import { mountFeedKeys } from './feed-keys.ts';
import { momentOf } from './feed-moment.ts';
import { clampFeedWindow, createFeedPaging, LIMIT, PAGE } from './feed-paging.ts';
import { createKeeper, createThreadSeat } from './feed-place.ts';
import { feedQuery } from './feed-query.ts';
import { mountScrub } from './feed-scrub.ts';
import { CHILD, DATED, hasDaySeparators, OWN, RAILED } from './feed-sources.ts';
import { type FeedState, showFeedState, signInButton } from './feed-state.ts';
import { feedTitle, showFeedTitle } from './feed-title.ts';
import { feedWindow, heldFresh, isOwnNote } from './feed-window.ts';
import { onHeld } from './held.ts';
import { mountHomeDrafts } from './home-drafts.ts';
import { pauseNoteAudio } from './note-audio.ts';
import { onOwnPublished } from './own-published.ts';
import { createPreviewWants } from './preview-wants.ts';
import { mountProfileKinds } from './profile-kinds.ts';
import type { ViewEnv } from './registry.ts';
import { watchHomeTitle } from './their-home.ts';
import { mountThread } from './thread.ts';
import { mountTimeRail } from './time-rail.ts';
export function mountFeed(el: HTMLElement, env: ViewEnv, kind: string): () => void {
  const state: FeedState = loadViewState<FeedState>(env.instance);
  const save = (): void => saveViewState(env.instance, state);
  const list = h('div', { class: 'list' });
  const drafts = kind === 'home' ? mountHomeDrafts(env) : undefined;
  const status = h('div', { class: 'fstate muted' });
  const signIn = signInButton(env);
  const fresh = createFresh(el, env, kind, () => toTop());
  const barSlot = h('div', { class: 'fslot' });
  const tail = h('div', { class: 'ftail' });
  const thread =
    kind === 'thread' ? mountThread({ el, env, state, save, redraw: () => sync() }) : null;
  const dates = (): boolean => hasDaySeparators(kind, state.show);
  const drawn = createRowList(list, thread?.env ?? env, dates, thread?.part);
  let rows: Row[] = [];
  let shown: readonly ListRow[] = [];
  let sub: Subscription | undefined;
  const previews = createPreviewWants(el, () => sub);
  let atTop = true;
  let atBottom = false;
  let mode: 'top' | 'held-head' | 'page' = 'top';
  let outside = { count: 0, own: false };
  let outsideBaseline: number | undefined;
  let waiting: boolean | 'rail' = false;
  let sstate: SubState | undefined;
  let account = env.engine.me();
  let can = ability(env.engine);
  let jump = false;
  const live = DATED.has(kind) || ['bookmarks', 'notifications', 'search'].includes(kind);
  const keeper = createKeeper({
    el,
    list,
    stretch: kind === 'thread' ? undefined : tail,
    saved: state.pos,
    active: () => el.isConnected && env.visible.get(),
    node: (key) => drawn.node(key),
    anchors: (key) => !/^(day|th|moment):/.test(key), // dividers and drawn parts never anchor
    save: (place) => ((state.pos = place), save()),
  });
  const query = (): Query => feedQuery(kind, account, state, env.engine, kinds?.query());
  const request = (anchor: Anchor, before: number, after: number, liveAbove = false): void => {
    [before, after] = clampFeedWindow(before, after);
    if (kind === 'thread' && before + after > (state.extent ?? PAGE)) {
      (state.extent = Math.min(LIMIT, before + after)), save();
    }
    waiting = true;
    outsideBaseline = anchor === 'top' || mode === 'held-head' ? 0 : undefined;
    sub?.window(anchor, before, after, liveAbove);
  };
  const moment = momentOf(kind, { el, state, save, keeper, drawn, request, sync: () => sync() });
  const paintFresh = (): void => {
    const staged = drafts?.count() ?? 0;
    if (mode === 'top') {
      if (atTop && !waiting && el.scrollTop < 8) state.head = feedWindow(kind, rows).first;
      fresh.show(el.scrollTop < 8 ? 0 : staged, false, staged > 0);
    } else {
      const own = staged > 0 || (outside.count > 0 ? outside.own : isOwnNote(rows[0]));
      const at = keys.held() ?? keeper.get()?.key;
      const arrivals = heldFresh(rows, live ? state.head : undefined, at, outside, outsideBaseline);
      fresh.show(arrivals.count + staged, arrivals.more, kind === 'home' && own);
    }
  };
  const sync = (): void => {
    const settle = keeper.hold(keys.held() ?? moment?.hold());
    drafts?.draw(rows);
    if (kinds && 'remember' in kinds && typeof kinds.remember === 'function') kinds.remember();
    drawn.draw((shown = thread?.plan(rows, sstate) ?? moment?.plan(rows) ?? rows));
    kinds?.seat(rows[0] && drawn.node(rows[0].key), rows[0]);
    showState();
    seat();
    settle();
    fresh.read(rows);
    paintFresh();
    keys.paint(), previews.sync(), rail.rowsChanged();
  };
  const seatThread = createThreadSeat(el, tail, keeper, Boolean(state.pos), drawn.node);
  const seat = (): void => void (thread && env.visible.get() && seatThread(shown));
  const showState = (): void =>
    showFeedState(
      status,
      !account && OWN.has(kind) ? signIn : undefined,
      shown,
      sstate,
      atBottom,
      kind === 'search' && !state.text,
      env.engine.accountState?.get().phase === 'failed',
      drafts?.visible() ?? false,
    );
  const follow = (): void => {
    if (rail.busy() || !sub || !env.visible.get()) return;
    sub.reading?.(keeper.get()?.key ?? rows[0]?.key ?? null);
    if (moment) return moment.follow(rows);
    if (kind === 'bookmarks' && sstate?.privateLists?.phase === 'loading') return;
    const head = atTop || mode === 'held-head' || (mode === 'top' && outside.count > 0);
    const overflow = fresh.overflow() && !waiting;
    const followHead = el.scrollTop < 8 && head && !keys.held() && !overflow;
    if (waiting && !(followHead && mode === 'held-head')) return;
    const window = feedWindow(kind, rows);
    if (followHead && (mode !== 'top' || outside.count > 0)) return showHead(window);
    if (!followHead && mode === 'top' && window.first) {
      if (window.count >= LIMIT) mode = 'page';
      else {
        mode = 'held-head';
        const after = Math.max(window.count, PAGE);
        return request({ key: window.first }, live ? LIMIT - after : 0, after, live);
      }
    }
    const direction = paging.next(window, atTop, atBottom, overflow);
    if (direction === 'older' && window.last) {
      (mode = 'page'), request({ key: window.last }, Math.min(window.count, LIMIT), PAGE);
    } else if (direction === 'newer' && mode === 'page' && window.first)
      request({ key: window.first }, PAGE, Math.min(window.count, LIMIT));
  };
  const read = (): void => (keeper.read(), fresh.read(rows), paintFresh());
  const paging = createFeedPaging(el, follow, read);
  const title = (): void => showFeedTitle(env, feedTitle(kind, rows, state), state, save);
  const open = (keep = false): void => {
    sub?.close();
    rail.reset();
    paging.reset();
    rows = [];
    const place = keep ? keeper.get() : undefined;
    if (!keep) (state.head = undefined), keeper.forget(), keys.clear();
    atTop = !place;
    mode = place ? 'page' : 'top';
    atBottom = waiting = jump = false;
    outside = { count: 0, own: false };
    sstate = undefined;
    sub = env.engine.open(query(), {
      rows(next, top, bottom) {
        rows = [...next];
        atTop = top;
        if (top)
          (state.head ??= feedWindow(kind, rows).first), (outside = { count: 0, own: false });
        atBottom = bottom;
        waiting = false;
        rail.window();
        if (jump) (jump = false), keeper.forget();
        sync();
        if (keeper.get() && !keeper.put() && (kind !== 'notifications' || rows.length > 0))
          keeper.forget();
        title();
        follow();
      },
      patch(ops) {
        rows = applyOps(rows, ops);
        sync();
        title();
        paging.schedule();
      },
      timeline: (next) => rail.timeline(next),
      timeWindow: (w) => moment?.answer(w),
      fresh(count, ownHead) {
        outside = { count, own: ownHead };
        outsideBaseline ??= count;
        paintFresh();
        if (count && el.scrollTop < 8 && (mode !== 'page' || atTop)) follow();
      },
      state(s) {
        sstate = s;
        thread ? sync() : showState();
        if (s.privateLists?.phase === 'ready') follow();
      },
    });
    sub.visible(env.visible.get());
    if (moment) moment.ask();
    else if (place) request({ key: place.key }, live ? LIMIT - PAGE : PAGE, PAGE, live);
    else request('top', 0, Math.max(PAGE, state.extent ?? PAGE));
    sync();
  };
  const showHead = (window?: ReturnType<typeof feedWindow>): void => {
    mode = 'top';
    fresh.show(0);
    const count = Math.max(PAGE, window?.count ?? 0);
    if (!live || !window?.last) return request('top', 0, count);
    waiting = true;
    outsideBaseline = 0;
    sub?.window('top', 0, count, false, window.last);
  };
  const toTop = (): void => {
    // Arrivals already drawn above the reader: up at once; the engine's answer only confirms it.
    if (mode === 'held-head' && !fresh.overflow() && !outside.count) keeper.forget();
    keys.clear(), (jump = true);
    showHead(live ? feedWindow(kind, rows) : undefined);
  };
  const keys = mountFeedKeys({
    el,
    list,
    env,
    closes: CHILD.has(kind),
    row: (key) => drawn.row(key),
    node: (key) => drawn.node(key),
    moved: () => (keeper.read(), follow()),
    top: () => (moment ? void (el.scrollTop = 0) : toTop()), // a moment's top: its first drawn row
  });
  el.classList.add('feed');
  const pin = h('div', { class: 'fpin' }, fresh.el);
  el.replaceChildren(barSlot, pin, ...(drafts ? [drafts.el] : []), list, status, tail);
  const rail = mountTimeRail({
    candidate: () => RAILED.has(kind) && !moment && (kind !== 'global' || Boolean(account)),
    version: () => env.engine.info.get()?.version ?? 5,
    el,
    list,
    tail,
    keeper,
    rows: () => rows,
    active: () => env.visible.get() && Boolean(el.closest('.pane.cur')),
    seek(anchor) {
      keys.clear(), (mode = 'page'), paging.reset(), request(anchor, PAGE, PAGE);
      if (waiting) waiting = 'rail';
    },
    seekExpired: () => void (waiting === 'rail' && ((waiting = false), paging.schedule())),
  });
  const offInfo = env.engine.info.subscribe(rail.sync);
  const scrub = mountScrub({ el, pin, list, row: (key) => drawn.row(key) });
  const bar = mountFeedBar({
    kind,
    el,
    slot: barSlot,
    state,
    env,
    save,
    reopen: () => (open(), title()),
  });
  const kinds =
    kind === 'profile'
      ? mountProfileKinds({ env, state, save, reopen: () => open() })
      : kind === 'channel'
        ? mountChannelDesk({ env, slot: barSlot })
        : undefined;
  if (state.title) env.setTitle(state.title);
  open(true);
  const owner = kind === 'their-home' ? watchHomeTitle(env, state, save, moment?.met) : undefined;
  const offVisible = env.visible.subscribe((on) => {
    sub?.visible(on);
    if (!on) pauseNoteAudio(list);
    if (on) seat(), keeper.put(), rail.rowsChanged(), follow();
  });
  const offAccounts = env.engine.accounts.subscribe((a) => {
    const now = ability(env.engine);
    if ((a.active ?? '') !== account)
      (account = a.active ?? ''), (can = now), drawn.clear(), open();
    else if (now !== can) (can = now), drawn.clear(), sync();
  });
  const offAccountState = env.engine.accountState?.subscribe(showState);
  const offHeld = onHeld(() => void (rows.length && sync()));
  const offDrafts = drafts?.watch(() => {
    const settle = keeper.hold(keys.held());
    drafts.draw(rows);
    settle(), paintFresh();
  });
  const offOwnPost = onOwnPublished((author) => {
    if (kind === 'global' && author === account && mode === 'top' && env.visible.get()) toTop();
  });
  const offSettings = env.settings.subscribe(() => (drawn.clear(), sync()));
  return () => {
    paging.dispose(), offDrafts?.(), offAccountState?.();
    for (const off of [offVisible, offInfo, offAccounts, offSettings, offHeld, offOwnPost, bar])
      off();
    kinds?.dispose();
    scrub();
    previews.dispose(), drawn.dispose(), rail.dispose(), thread?.dispose();
    keys.dispose(), keeper.dispose();
    sub?.close();
    owner?.(), fresh.dispose();
  };
}
