import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Anchor, Query, Row, SubState } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { ability } from './can.ts';
import { mountChannelDesk } from './channel-desk.ts';
import { mountFeedBar } from './feed-bar.ts';
import { createRowList } from './feed-draw.ts';
import { createFresh } from './feed-fresh.ts';
import { mountFeedKeys } from './feed-keys.ts';
import { createKeeper, createThreadSeat } from './feed-place.ts';
import { feedQuery } from './feed-query.ts';
import { mountScrub } from './feed-scrub.ts';
import { CHILD, DATED, hasDaySeparators, OWN } from './feed-sources.ts';
import { type FeedState, showFeedState } from './feed-state.ts';
import { feedTitle } from './feed-title.ts';
import { feedWindow, heldFresh, isOwnNote } from './feed-window.ts';
import { onHeld } from './held.ts';
import { mountHomeDrafts } from './home-drafts.ts';
import { pauseNoteAudio } from './note-audio.ts';
import { onOwnPublished } from './own-published.ts';
import { createPreviewWants } from './preview-wants.ts';
import { mountProfileKinds } from './profile-kinds.ts';
import type { ViewEnv } from './registry.ts';
import { watchHomeTitle } from './their-home.ts';
import { mountTimeRail } from './time-rail.ts';

const PAGE = 60;
const LIMIT = 800;
const NEAR_PX = 1400;
export function mountFeed(el: HTMLElement, env: ViewEnv, kind: string): () => void {
  const state: FeedState = loadViewState<FeedState>(env.instance);
  const save = (): void => saveViewState(env.instance, state);
  const list = h('div', { class: 'list' });
  const drafts = kind === 'home' ? mountHomeDrafts(env) : undefined;
  const status = h('div', { class: 'fstate muted' });
  const signIn = h(
    'button',
    { class: 'btn primary', onclick: () => env.open('account') },
    t('bar.signedOut'),
  );
  const fresh = createFresh(el, env, kind, () => toTop());
  const barSlot = h('div', { class: 'fslot' });
  const tail = h('div', { class: 'ftail' });
  const drawn = createRowList(list, env, () => hasDaySeparators(kind, state.show));
  let rows: Row[] = [];
  let sub: Subscription | undefined;
  const previews = createPreviewWants(el, () => sub);
  let atTop = true;
  let atBottom = false;
  let mode: 'top' | 'held-head' | 'page' = 'top';
  let above = 0;
  let newestOutsideOwn = false;
  let outsideBaseline: number | undefined;
  let waiting = false;
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
    anchors: (key) => !key.startsWith('day:'),
    save: (place) => ((state.pos = place), save()),
  });
  const query = (): Query => feedQuery(kind, account, state, env.engine, kinds?.query());
  const request = (anchor: Anchor, before: number, after: number, liveAbove = false): void => {
    const extra = Math.max(0, before + after - LIMIT);
    if (before > after) before -= extra;
    else after -= extra;
    if (kind === 'thread' && before + after > (state.extent ?? PAGE)) {
      (state.extent = Math.min(LIMIT, before + after)), save();
    }
    waiting = true;
    outsideBaseline = anchor === 'top' || mode === 'held-head' ? 0 : undefined;
    sub?.window(anchor, before, after, liveAbove);
  };
  const paintFresh = (): void => {
    const staged = drafts?.count() ?? 0;
    if (mode === 'top') {
      if (atTop && !waiting && el.scrollTop < 8) state.head = feedWindow(kind, rows).first;
      fresh.show(el.scrollTop < 8 ? 0 : staged, false, staged > 0);
    } else {
      const own = staged > 0 || (above > 0 ? newestOutsideOwn : isOwnNote(rows[0]));
      const at = keys.held() ?? keeper.get()?.key;
      const arrivals = heldFresh(rows, live ? state.head : undefined, at, above, outsideBaseline);
      fresh.show(arrivals.count + staged, arrivals.more, kind === 'home' && own);
    }
  };
  const sync = (): void => {
    const settle = keeper.hold(keys.held());
    drafts?.draw(rows);
    drawn.draw(rows);
    kinds?.seat(rows[0] && drawn.node(rows[0].key), rows[0]);
    showState();
    seat();
    settle();
    fresh.read(rows);
    paintFresh();
    keys.paint(), previews.sync(), rail.sync();
  };
  const seatThread = createThreadSeat(el, tail, keeper, Boolean(state.pos), drawn.node);
  const seat = (): void => void (kind === 'thread' && env.visible.get() && seatThread(rows));
  const showState = (): void =>
    showFeedState(
      status,
      !account && OWN.has(kind) ? signIn : undefined,
      rows,
      sstate,
      atBottom,
      kind === 'search' && !state.text,
      env.engine.accountState?.get().phase === 'failed',
    );
  const follow = (): void => {
    if (rail.busy() || !sub || !env.visible.get()) return;
    sub.reading?.(keeper.get()?.key ?? rows[0]?.key ?? null);
    if (kind === 'bookmarks' && sstate?.privateLists?.phase === 'loading') return;
    const head = atTop || mode === 'held-head' || (mode === 'top' && above > 0);
    const overflow = fresh.overflow() && !waiting;
    const followHead = el.scrollTop < 8 && head && !keys.held() && !overflow;
    if (waiting && !(followHead && mode === 'held-head')) return;
    const { first, last, count } = feedWindow(kind, rows);
    if (followHead) {
      if (mode !== 'top' || above > 0) {
        mode = 'top';
        fresh.show(0);
        request('top', 0, Math.max(PAGE, Math.min(count, LIMIT)));
      }
    } else if (mode === 'top' && first) {
      mode = 'held-head';
      const after = Math.max(count, PAGE);
      request({ key: first }, live ? LIMIT - after : 0, after, live);
    } else if (el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_PX && !atBottom && last) {
      (mode = 'page'), request({ key: last }, Math.min(count, LIMIT), PAGE);
    } else if (el.scrollTop < NEAR_PX && !atTop && mode === 'page' && first && !overflow)
      request({ key: first }, PAGE, Math.min(count, LIMIT));
  };
  let frame = 0;
  const onScroll = (): void => {
    keeper.read(), fresh.read(rows), paintFresh();
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), follow()));
  };
  el.addEventListener('scroll', onScroll, { passive: true });
  const title = (): void => {
    const next = feedTitle(kind, rows, state);
    if (!next) return;
    if (next !== state.title) (state.title = next), save();
    env.setTitle(next);
  };
  const open = (keep = false): void => {
    sub?.close();
    rail.reset();
    rows = [];
    const place = keep ? keeper.get() : undefined;
    if (!keep) (state.head = undefined), keeper.forget(), keys.clear();
    atTop = !place;
    mode = place ? 'page' : 'top';
    atBottom = waiting = jump = false;
    above = 0;
    sstate = undefined;
    sub = env.engine.open(query(), {
      rows(next, top, bottom) {
        rows = [...next];
        atTop = top;
        if (top) (state.head ??= feedWindow(kind, rows).first), (above = 0);
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
        if (env.visible.get()) sub?.reading?.(keeper.get()?.key ?? rows[0]?.key ?? null);
      },
      timeline: (next) => rail.timeline(next),
      fresh(count, ownHead) {
        above = count;
        newestOutsideOwn = ownHead;
        outsideBaseline ??= count;
        paintFresh();
        if (count && el.scrollTop < 8 && (mode !== 'page' || atTop)) follow();
      },
      state(s) {
        sstate = s;
        showState();
        if (s.privateLists?.phase === 'ready') follow();
      },
    });
    sub.visible(env.visible.get());
    if (place) request({ key: place.key }, live ? LIMIT - PAGE : PAGE, PAGE, live);
    else request('top', 0, Math.max(PAGE, state.extent ?? PAGE));
    sync();
  };
  const toTop = (): void => {
    keys.clear(), fresh.show(0);
    jump = true;
    mode = 'top';
    request('top', 0, PAGE);
  };
  const keys = mountFeedKeys({
    el,
    list,
    env,
    closes: CHILD.has(kind),
    row: (key) => drawn.row(key),
    node: (key) => drawn.node(key),
    moved: () => (keeper.read(), follow()),
    top: toTop,
  });
  el.classList.add('feed');
  const pin = h('div', { class: 'fpin' }, fresh.el);
  el.replaceChildren(barSlot, pin, ...(drafts ? [drafts.el] : []), list, status, tail);
  const rail = mountTimeRail({
    candidate: DATED.has(kind) && kind !== 'bookmarks',
    version: () => env.engine.info.get()?.version ?? 5,
    el,
    list,
    tail,
    keeper,
    rows: () => rows,
    active: () => env.visible.get() && Boolean(el.closest('.pane.cur')),
    seek: (anchor) => {
      keys.clear();
      mode = 'page';
      request(anchor, PAGE, PAGE);
    },
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
  const owner = kind === 'their-home' ? watchHomeTitle(env, state, save) : undefined;
  const offVisible = env.visible.subscribe((on) => {
    sub?.visible(on);
    if (!on) pauseNoteAudio(list);
    if (on) seat(), keeper.put(), follow();
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
    cancelAnimationFrame(frame);
    offDrafts?.();
    offAccountState?.();
    for (const off of [offVisible, offInfo, offAccounts, offSettings, offHeld, offOwnPost, bar])
      off();
    kinds?.dispose();
    scrub();
    previews.dispose(), drawn.dispose(), rail.dispose();
    keys.dispose();
    keeper.dispose();
    sub?.close();
    owner?.();
    fresh.dispose();
  };
}
