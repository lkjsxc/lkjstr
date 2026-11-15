// Every list of rows is this one view: home, global, a hashtag, search, bookmarks, a thread, a profile, people,
// notifications. It keeps a window of rows around what is on screen and never lets the content jump: at the very
// top new notes flow in by themselves; anywhere else the position holds and a quiet pill counts what is above.
import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Anchor, Query, Row, Source, SubState } from '../engine/protocol.ts';
import { fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { ability } from './can.ts';
import { type BarState, mountFeedBar, typesQuery } from './feed-bar.ts';
import { createRowList } from './feed-draw.ts';
import { mountFeedKeys } from './feed-keys.ts';
import { createKeeper, type Place } from './feed-place.ts';
import { filterQuery } from './filter-bar.ts';
import { onHeld } from './held.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const PAGE = 60; // rows asked for beyond what is on screen
const KEEP = 120; // rows kept on the far side when the window slides
const NEAR_PX = 1400;
type State = BarState & {
  title?: string;
  pubkey?: string;
  id?: string;
  ref?: string;
  tag?: string;
  /** Where the reader is, so the tab comes back to the same note after anything: a reload, another tile. */
  pos?: Place;
};
/** Tabs opened from a note: Escape closes them once nothing is selected. */
const CHILD = new Set(['thread', 'profile', 'hashtag', 'following', 'followers']);
const FILTERED = new Set(['home', 'global', 'hashtag', 'bookmarks', 'search', 'profile']);
const DATED = new Set(['home', 'global', 'hashtag', 'bookmarks', 'search', 'profile']);
/** Lists that belong to an account: signed out they have nothing to ask for, and say how to get one. */
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
  const barSlot = h('div');
  const tail = h('div', { class: 'ftail' });
  const drawn = createRowList(list, env, DATED.has(kind));
  let rows: Row[] = [];
  let sub: Subscription | undefined;
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
    ...(kind === 'search' ? { text: state.text ?? '' } : {}),
    ...(kind === 'notifications' ? { types: typesQuery(state.only) } : {}),
    ...(FILTERED.has(kind)
      ? filterQuery(
          { ...state.filter, ...(kind === 'search' ? { text: state.text } : {}) },
          Date.now(),
        )
      : {}),
  });
  const request = (anchor: Anchor, before: number, after: number): void => {
    waiting = true;
    sub?.window(anchor, before, after);
  };

  /** Draws the rows and keeps what is on screen where it is. */
  const sync = (): void => {
    const settle = keeper.hold();
    drawn.draw(rows);
    showState();
    seat();
    settle();
    keys.paint();
  };
  /** A thread opens on its focused note, the notes it answers above it: room is kept below so that the note can
   * stand at the top of the tile however few replies follow. */
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
    // A profile's header alone is not content: the line below it says whether notes are still being asked for.
    const empty = rows.every((r) => r.kind === 'profile');
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
    // Signed out, a list of one's own is not "empty": the one thing to say is the way in.
    if (empty && !account && OWN.has(kind)) status.replaceChildren(signIn);
    else status.textContent = key ? t(key) : '';
    status.title = sstate?.lastArrival
      ? t('feed.lastArrival', { time: fullTime(sstate.lastArrival) })
      : '';
  };

  /** Decides, from where the reader is, which window the engine should keep. */
  const follow = (): void => {
    if (waiting || !sub || !env.visible.get()) return;
    const top = el.scrollTop;
    const room = el.scrollHeight - top - el.clientHeight;
    const first = rows[0]?.key;
    const last = rows[rows.length - 1]?.key;
    if (top < 8 && atTop && !keys.held()) {
      if (!live) (live = true), request('top', 0, Math.max(PAGE, Math.min(rows.length, KEEP)));
    } else if (live && first)
      (live = false), request({ key: first }, 0, Math.max(rows.length, PAGE));
    else if (room < NEAR_PX && !atBottom && last) request({ key: last }, KEEP, PAGE);
    else if (top < NEAR_PX && !atTop && first) request({ key: first }, PAGE, KEEP);
  };
  let frame = 0;
  const onScroll = (): void => {
    keeper.read();
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), follow()));
  };
  el.addEventListener('scroll', onScroll, { passive: true });

  const title = (): void => {
    const profile = rows.find((r) => r.kind === 'profile');
    const focus = rows.find((r) => r.kind === 'note' && r.thread?.role === 'focus');
    const next =
      profile?.kind === 'profile'
        ? plainName(profile.author)
        : focus?.kind === 'note'
          ? plainName(focus.author)
          : kind === 'hashtag'
            ? `#${state.tag ?? ''}`
            : kind === 'search' && state.text
              ? state.text
              : state.title;
    if (!next) return;
    if (next !== state.title) (state.title = next), save();
    env.setTitle(next);
  };
  /** `keep`: the tab is coming back (a reload, a reopened tab), so it asks for the rows around its place. */
  const open = (keep = false): void => {
    sub?.close();
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
        if (jump) (jump = false), keeper.forget();
        sync();
        // The place is a row that no longer exists (deleted, muted, a filter): the list starts over from its head.
        if (keeper.get() && !keeper.put()) keeper.forget();
        title();
        follow();
      },
      patch(ops) {
        rows = applyOps(rows, ops);
        sync();
        title(); // a name that arrives late renames the tab in place
      },
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
    else request('top', 0, PAGE);
    sync();
  };
  /** To the newest notes, wherever the window is. Nothing is shown in between: the scroll waits for the rows. */
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
    cover: () => barSlot.offsetHeight,
    moved: () => (keeper.read(), follow()),
    top: toTop,
  });

  el.classList.add('feed');
  el.replaceChildren(h('div', { class: 'fslot' }, barSlot, pill), list, status, tail);
  const bar = mountFeedBar({
    kind,
    el,
    slot: barSlot,
    state,
    env,
    save,
    reopen: () => (open(), title()),
  });

  if (state.title) env.setTitle(state.title);
  open(true);
  const offVisible = env.visible.subscribe((on) => {
    sub?.visible(on);
    if (on) seat(), keeper.put(), follow();
  });
  const offAccounts = env.engine.accounts.subscribe((a) => {
    const now = ability(env.engine);
    if ((a.active ?? '') !== account)
      (account = a.active ?? ''), (can = now), drawn.clear(), open();
    // The same reader, now known to be read-only (or no longer): the action rows are drawn again.
    else if (now !== can) (can = now), drawn.clear(), sync();
  });
  const offHeld = onHeld(() => void (rows.length && sync()));
  const offSettings = env.settings.subscribe(() => (drawn.clear(), sync()));
  return () => {
    cancelAnimationFrame(frame);
    offVisible();
    offAccounts();
    offSettings();
    offHeld();
    bar();
    keys.dispose();
    keeper.dispose();
    sub?.close();
  };
}
