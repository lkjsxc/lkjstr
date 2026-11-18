import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Anchor, Query, Row, SubState } from '../engine/protocol.ts';
import { fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { ability } from './can.ts';
import { mountChannelDesk } from './channel-desk.ts';
import { type BarState, mountFeedBar } from './feed-bar.ts';
import { createRowList } from './feed-draw.ts';
import { createFresh } from './feed-fresh.ts';
import { mountFeedKeys } from './feed-keys.ts';
import { createKeeper, type Place } from './feed-place.ts';
import { feedQuery } from './feed-query.ts';
import { mountScrub } from './feed-scrub.ts';
import { CHILD, DATED, hasDaySeparators, OWN } from './feed-sources.ts';
import { feedState } from './feed-state.ts';
import { feedTitle } from './feed-title.ts';
import { feedWindow } from './feed-window.ts';
import { onHeld } from './held.ts';
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
type State = BarState & {
  title?: string;
  pubkey?: string;
  id?: string;
  ref?: string;
  tag?: string;
  show?: string;
  pos?: Place;
  extent?: number;
};
export function mountFeed(el: HTMLElement, env: ViewEnv, kind: string): () => void {
  const state: State = loadViewState<State>(env.instance);
  const save = (): void => saveViewState(env.instance, state);
  const list = h('div', { class: 'list' });
  const status = h('div', { class: 'fstate muted' });
  const signIn = h(
    'button',
    { class: 'btn primary', onclick: () => env.open('account') },
    t('bar.signedOut'),
  );
  const fresh = createFresh(el, env, kind, () => toTop());
  const pill = fresh.el;
  const barSlot = h('div', { class: 'fslot' });
  const tail = h('div', { class: 'ftail' });
  const drawn = createRowList(list, env, () => hasDaySeparators(kind, state.show));
  let rows: Row[] = [];
  let sub: Subscription | undefined;
  const previews = createPreviewWants(el, () => sub);
  let atTop = true;
  let atBottom = false;
  let mode: 'top' | 'held-head' | 'page' = 'top';
  let above = 0; // rows above the window, as the engine last counted them
  let waiting = false;
  let sstate: SubState | undefined;
  let account = env.engine.me();
  let can = ability(env.engine);
  let jump = false;
  const keeper = createKeeper({
    el,
    list,
    saved: state.pos,
    active: () => el.isConnected && env.visible.get(),
    node: (key) => drawn.node(key),
    anchors: (key) => !key.startsWith('day:'),
    save: (place) => ((state.pos = place), save()),
  });
  const query = (): Query => feedQuery(kind, account, state, env.engine, kinds?.query());
  const request = (anchor: Anchor, before: number, after: number): void => {
    const extra = Math.max(0, before + after - LIMIT);
    if (before > after) before -= extra;
    else after -= extra;
    if (kind === 'thread' && before + after > (state.extent ?? PAGE)) {
      (state.extent = Math.min(LIMIT, before + after)), save();
    }
    waiting = true;
    sub?.window(anchor, before, after);
  };
  const sync = (): void => {
    if (kind === 'notifications' && el.scrollTop >= 8) keeper.read();
    const settle = keeper.hold();
    drawn.draw(rows);
    kinds?.seat(rows[0] && drawn.node(rows[0].key), rows[0]);
    showState();
    seat();
    settle();
    fresh.read(rows);
    keys.paint();
    previews.sync(), rail.sync();
    if (env.visible.get()) sub?.reading?.(keeper.get()?.key ?? rows[0]?.key ?? null);
  };
  let seated = kind !== 'thread' || Boolean(state.pos);
  const seat = (): void => {
    if (kind !== 'thread' || !env.visible.get()) return;
    const focus = rows.find((r) => r.kind === 'note' && r.thread?.role === 'focus');
    const node = focus && drawn.node(focus.key);
    if (!node) return;
    const below = tail.getBoundingClientRect().top - node.getBoundingClientRect().top;
    tail.style.height = `${Math.max(0, Math.ceil(el.clientHeight - below))}px`;
    if (seated) return;
    seated = true;
    if (rows[0] !== focus) keeper.set({ key: focus.key, off: 0 });
  };
  const showState = (): void => {
    const { empty, key } = feedState(
      rows,
      sstate,
      atBottom,
      kind === 'search' && !state.text,
      env.engine.accountState?.get().phase === 'failed',
    );
    if (key !== 'error.internal' && empty && !account && OWN.has(kind))
      status.replaceChildren(signIn);
    else status.textContent = key ? t(key) : '';
    status.title = sstate?.lastArrival
      ? t('feed.lastArrival', { time: fullTime(sstate.lastArrival) })
      : '';
  };
  const follow = (): void => {
    if (env.visible.get()) sub?.reading?.(keeper.get()?.key ?? rows[0]?.key ?? null);
    if (waiting || rail.busy() || !sub || !env.visible.get()) return;
    if (kind === 'bookmarks' && sstate?.privateLists?.phase === 'loading') return;
    const top = el.scrollTop;
    const room = el.scrollHeight - top - el.clientHeight;
    const { first, last, count } = feedWindow(kind, rows);
    const head = atTop || mode === 'held-head' || (mode === 'top' && above > 0);
    if (top < 8 && head && !keys.held()) {
      if (mode !== 'top' || above > 0) {
        mode = 'top';
        fresh.show(0);
        request('top', 0, Math.max(PAGE, Math.min(count, LIMIT)));
      }
    } else if (mode === 'top' && first) {
      (mode = 'held-head'), request({ key: first }, 0, Math.max(count, PAGE));
    } else if (room < NEAR_PX && !atBottom && last) {
      (mode = 'page'), request({ key: last }, Math.min(count, LIMIT), PAGE);
    } else if (top < NEAR_PX && !atTop && mode === 'page' && first)
      request({ key: first }, PAGE, Math.min(count, LIMIT));
  };
  let frame = 0;
  const onScroll = (): void => {
    keeper.read(), fresh.read(rows);
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
    if (!keep) keeper.forget(), keys.clear();
    atTop = !place;
    mode = place ? 'page' : 'top';
    atBottom = waiting = jump = false;
    above = 0;
    sstate = undefined;
    fresh.show(0);
    sub = env.engine.open(query(), {
      rows(next, top, bottom) {
        rows = [...next];
        atTop = top;
        if (top) above = 0;
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
        title(); // a name that arrives late renames the tab in place
      },
      timeline: (next) => rail.timeline(next),
      fresh(count) {
        // A replayed screen is pinned below `top`; its first count is the cue to follow the head again.
        above = count;
        if (count && el.scrollTop < 8 && (mode !== 'page' || atTop)) follow();
        fresh.show(mode === 'top' ? 0 : count);
      },
      state(s) {
        sstate = s;
        showState();
        if (s.privateLists?.phase === 'ready') follow();
      },
    });
    sub.visible(env.visible.get());
    if (place) request({ key: place.key }, PAGE, PAGE);
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
  const pin = h('div', { class: 'fpin' }, pill);
  el.replaceChildren(barSlot, pin, list, status, tail);
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
  const offOwnPost = onOwnPublished((author) => {
    // Preserve a scrolled position; at the top the author's own new note is the new head.
    if (kind === 'global' && author === account && el.scrollTop < 8 && env.visible.get()) toTop();
  });
  const offSettings = env.settings.subscribe(() => (drawn.clear(), sync()));
  return () => {
    cancelAnimationFrame(frame);
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
