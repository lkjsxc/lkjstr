import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Anchor, Query, Row, Source, SubState } from '../engine/protocol.ts';
import { fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { ability, rich } from './can.ts';
import { mountChannelDesk } from './channel-desk.ts';
import { type BarState, mountFeedBar, typesQuery } from './feed-bar.ts';
import { createRowList } from './feed-draw.ts';
import { mountFeedKeys } from './feed-keys.ts';
import { createKeeper, type Place } from './feed-place.ts';
import { mountScrub } from './feed-scrub.ts';
import { feedTitle } from './feed-title.ts';
import { filterQuery } from './filter-bar.ts';
import { onHeld } from './held.ts';
import { pauseNoteAudio } from './note-audio.ts';
import { createPreviewWants } from './preview-wants.ts';
import { mountProfileKinds } from './profile-kinds.ts';
import type { ViewEnv } from './registry.ts';
import { mountTimeRail } from './time-rail.ts';

const PAGE = 60; // Prefetch size.
const LIMIT = 800; // Maximum retained rows.
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
const CHILD = new Set(['thread', 'profile', 'hashtag', 'following', 'followers', 'channel']);
const FILTERED = new Set(['home', 'global', 'hashtag', 'bookmarks', 'search', 'profile']);
const DATED = new Set(['home', 'global', 'hashtag', 'bookmarks', 'search', 'profile', 'channel']);
const OWN = new Set(['home', 'notifications', 'bookmarks']);
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
  const pill = h('button', { class: 'fresh', hidden: true });
  const barSlot = h('div', { class: 'fslot' });
  const tail = h('div', { class: 'ftail' });
  const drawn = createRowList(list, env, DATED.has(kind));
  let rows: Row[] = [];
  let sub: Subscription | undefined;
  const previews = createPreviewWants(el, () => sub);
  let atTop = true;
  let atBottom = false;
  let live = true;
  let waiting = false;
  let sstate: SubState | undefined;
  let account = env.engine.me();
  let can = ability(env.engine);
  let jump = false; // the next rows are the head of the list: show them from the top
  const keeper = createKeeper({
    el,
    list,
    saved: state.pos,
    active: () => el.isConnected && env.visible.get(),
    node: (key) => drawn.node(key),
    anchors: (key) => !key.startsWith('day:'),
    save: (place) => ((state.pos = place), save()),
  });
  const query = (): Query => ({
    source: kind as Source,
    account: account || undefined,
    pubkey: state.pubkey,
    id: state.id,
    ref: state.ref,
    tag: state.tag,
    ...(kind === 'search' ? { text: '' } : {}),
    ...(kind === 'notifications' ? { types: typesQuery(state.only) } : {}),
    ...(FILTERED.has(kind)
      ? filterQuery(
          { ...state.filter, ...(kind === 'search' ? { text: state.text } : {}) },
          rich(env.engine),
        )
      : {}),
    ...kinds?.query(),
  });
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
    const settle = keeper.hold();
    drawn.draw(rows);
    kinds?.seat(rows[0] && drawn.node(rows[0].key), rows[0]);
    showState();
    seat();
    settle();
    keys.paint();
    previews.sync(), rail.sync();
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
    const empty = rows.every((r) => r.kind === 'profile' || r.kind === 'channel');
    const phase = sstate?.phase ?? 'cache';
    const key: Key | null = !empty
      ? atBottom && rows.length > 8
        ? 'feed.end'
        : null
      : kind === 'search' && !state.text
        ? 'feed.searchHint'
        : phase === 'cache'
          ? 'feed.loading'
          : phase === 'failed'
            ? 'feed.failed'
            : 'feed.empty';
    if (empty && !account && OWN.has(kind)) status.replaceChildren(signIn);
    else status.textContent = key ? t(key) : '';
    status.title = sstate?.lastArrival
      ? t('feed.lastArrival', { time: fullTime(sstate.lastArrival) })
      : '';
  };
  const follow = (): void => {
    if (waiting || rail.busy() || !sub || !env.visible.get()) return;
    const top = el.scrollTop;
    const room = el.scrollHeight - top - el.clientHeight;
    const first = rows[0]?.key;
    const last = rows[rows.length - 1]?.key;
    if (top < 8 && atTop && !keys.held()) {
      if (!live) (live = true), request('top', 0, Math.max(PAGE, Math.min(rows.length, LIMIT)));
    } else if (live && first)
      (live = false), request({ key: first }, 0, Math.max(rows.length, PAGE));
    else if (room < NEAR_PX && !atBottom && last)
      request({ key: last }, Math.min(rows.length, LIMIT), PAGE);
    else if (top < NEAR_PX && !atTop && first)
      request({ key: first }, PAGE, Math.min(rows.length, LIMIT));
  };
  let frame = 0;
  const onScroll = (): void => {
    keeper.read();
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
    atTop = live = !place;
    atBottom = waiting = jump = false;
    sstate = undefined;
    pill.hidden = true;
    sub = env.engine.open(query(), {
      rows(next, top, bottom) {
        rows = [...next];
        atTop = top;
        atBottom = bottom;
        waiting = false;
        rail.window();
        if (jump) (jump = false), keeper.forget();
        sync();
        if (keeper.get() && !keeper.put()) keeper.forget();
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
        pill.hidden = count === 0;
        pill.replaceChildren(icon('up'), t('feed.fresh', { n: count }));
      },
      state(s) {
        sstate = s;
        showState();
      },
    });
    sub.visible(env.visible.get());
    if (place) request({ key: place.key }, PAGE, PAGE);
    else request('top', 0, Math.max(PAGE, state.extent ?? PAGE));
    sync();
  };
  const toTop = (): void => {
    keys.clear();
    if (atTop) return (keeper.forget(), follow());
    jump = live = true;
    request('top', 0, PAGE);
  };
  pill.addEventListener('click', toTop);
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
      live = false;
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
  const offHeld = onHeld(() => void (rows.length && sync()));
  const offSettings = env.settings.subscribe(() => (drawn.clear(), sync()));
  return () => {
    cancelAnimationFrame(frame);
    offVisible();
    offInfo();
    offAccounts();
    offSettings();
    offHeld();
    bar();
    kinds?.dispose();
    scrub();
    previews.dispose(), drawn.dispose(), rail.dispose();
    keys.dispose();
    keeper.dispose();
    sub?.close();
  };
}
