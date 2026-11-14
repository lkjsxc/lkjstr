// Every list of rows is this one view: home, global, a hashtag, search, bookmarks, a thread, a profile, people,
// notifications. It keeps a window of rows around what is on screen and never lets the content jump: at the very
// top new notes flow in by themselves; anywhere else the position holds and a quiet pill counts what is above.
import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Anchor, Query, Row, Source, SubState } from '../engine/protocol.ts';
import { dayOf, fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { type Filter, filterBar, filterQuery } from './filter-bar.ts';
import { bodySig, fitNote, patchNote, renderNote } from './note.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { renderNotification, renderPerson, renderProfile } from './rows.ts';

const PAGE = 60; // rows asked for beyond what is on screen
const KEEP = 120; // rows kept on the far side when the window slides
const NEAR_PX = 1400;
type State = {
  title?: string;
  pubkey?: string;
  id?: string;
  ref?: string;
  tag?: string;
  text?: string;
  filter?: Filter;
};
const FILTERED = new Set(['home', 'global', 'hashtag', 'bookmarks', 'search', 'profile']);
const DATED = new Set(['home', 'global', 'hashtag', 'bookmarks', 'search', 'profile']);

export function mountFeed(el: HTMLElement, env: ViewEnv, kind: string): () => void {
  const state: State = loadViewState<State>(env.instance);
  const save = (): void => saveViewState(env.instance, state);
  const list = h('div', { class: 'list' });
  const status = h('div', { class: 'fstate muted' });
  const pill = h('button', { class: 'fresh', hidden: true });
  const barSlot = h('div');
  const nodes = new Map<string, { el: HTMLElement; sig: string; body?: string }>(); // bound: rows of the window plus day dividers
  let rows: Row[] = [];
  let sub: Subscription | undefined;
  let atTop = true;
  let atBottom = false;
  let live = true;
  let waiting = false;
  let sstate: SubState | undefined;
  let account = env.engine.me();

  const query = (): Query => ({
    source: kind as Source,
    account: account || undefined,
    pubkey: state.pubkey,
    id: state.id,
    ref: state.ref,
    tag: state.tag,
    ...(kind === 'search' ? { text: state.text ?? '' } : {}),
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

  const render = (row: Row): HTMLElement | null => {
    if (row.kind === 'note') return renderNote(row, env, { dated: DATED.has(kind) });
    if (row.kind === 'profile') return renderProfile(row, env);
    if (row.kind === 'person') return renderPerson(row, env);
    if (row.kind === 'notification') return renderNotification(row, env);
    return null;
  };
  /** Draws `rows`, reusing every node whose row did not change, and keeps what is on screen where it is. */
  const sync = (): void => {
    const box = el.getBoundingClientRect();
    const hold =
      el.scrollTop < 8
        ? undefined
        : [...list.children].find((c) => c.getBoundingClientRect().bottom > box.top + 1);
    const was = hold?.getBoundingClientRect().top ?? 0;
    const want: HTMLElement[] = [];
    const seen = new Set<string>();
    const today = dayOf(Date.now());
    let day = DATED.has(kind) ? today : '';
    const put = (key: string, sig: string, make: () => HTMLElement | null): void => {
      let n = nodes.get(key);
      if (!n || n.sig !== sig) {
        const made = make();
        if (!made) return;
        n = { el: made, sig };
        nodes.set(key, n);
        made.dataset.key = key;
      }
      seen.add(key);
      want.push(n.el);
    };
    for (const row of rows) {
      const at = row.kind === 'note' ? (row.repostedBy?.at ?? row.at) : 0;
      if (at && day && dayOf(at) !== day) {
        day = dayOf(at);
        put(`day:${day}`, day, () => h('div', { class: 'day' }, day));
      }
      const sig = JSON.stringify(row);
      const had = nodes.get(row.key);
      // Only counts or reactions changed: the drawn note stays, its chips and action row are redrawn.
      if (
        row.kind === 'note' &&
        !row.hidden &&
        had &&
        had.sig !== sig &&
        had.body === bodySig(row)
      ) {
        patchNote(had.el, row, env);
        had.sig = sig;
      }
      put(row.key, sig, () => render(row));
      const now = nodes.get(row.key);
      if (now && row.kind === 'note') now.body = bodySig(row);
    }
    let cursor = list.firstChild;
    for (const node of want) {
      if (node === cursor) cursor = cursor.nextSibling;
      else list.insertBefore(node, cursor);
    }
    while (cursor) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
    for (const key of [...nodes.keys()]) if (!seen.has(key)) nodes.delete(key);
    for (const node of want) if (!node.dataset.fit) (node.dataset.fit = '1'), fitNote(node);
    if (hold?.isConnected) el.scrollTop += hold.getBoundingClientRect().top - was;
    showState();
  };
  const showState = (): void => {
    const empty = rows.length === 0;
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
    status.textContent = key ? t(key) : '';
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
    if (top < 8 && atTop) {
      if (!live) (live = true), request('top', 0, Math.max(PAGE, Math.min(rows.length, KEEP)));
    } else if (live && first)
      (live = false), request({ key: first }, 0, Math.max(rows.length, PAGE));
    else if (room < NEAR_PX && !atBottom && last) request({ key: last }, KEEP, PAGE);
    else if (top < NEAR_PX && !atTop && first) request({ key: first }, PAGE, KEEP);
  };
  let frame = 0;
  const onScroll = (): void => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), follow()));
  };
  el.addEventListener('scroll', onScroll, { passive: true });

  const title = (): void => {
    const profile = rows.find((r) => r.kind === 'profile');
    const next =
      profile?.kind === 'profile'
        ? plainName(profile.author)
        : kind === 'hashtag'
          ? `#${state.tag ?? ''}`
          : kind === 'search' && state.text
            ? state.text
            : state.title;
    if (!next) return;
    if (next !== state.title) (state.title = next), save();
    env.setTitle(next);
  };
  const open = (): void => {
    sub?.close();
    rows = [];
    atTop = live = true;
    atBottom = waiting = false;
    sstate = undefined;
    pill.hidden = true;
    sub = env.engine.open(query(), {
      rows(next, top, bottom) {
        rows = [...next];
        atTop = top;
        atBottom = bottom;
        waiting = false;
        sync();
        title();
        follow();
      },
      patch(ops) {
        rows = applyOps(rows, ops);
        sync();
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
    request('top', 0, PAGE);
    sync();
  };
  pill.addEventListener('click', () => el.scrollTo({ top: 0 }));

  const bar = (): void => {
    if (!FILTERED.has(kind) || kind === 'profile') return;
    const f: Filter = { ...state.filter, ...(kind === 'search' ? { text: state.text } : {}) };
    barSlot.replaceChildren(
      filterBar(f, kind === 'search' ? 'filter.search' : 'filter.contains', (next, typing) => {
        if (kind === 'search') state.text = next.text;
        state.filter = kind === 'search' ? { ...next, text: undefined } : next;
        save();
        const narrowed = JSON.stringify(filterQuery(next, 0)) !== JSON.stringify(filterQuery(f, 0));
        if (!typing) bar();
        if (narrowed || typing) open(), title();
      }),
    );
    if (kind === 'search' && !state.text)
      barSlot.querySelector('input')?.focus({ preventScroll: true });
  };

  el.classList.add('feed');
  el.replaceChildren(barSlot, pill, list, status);
  bar();
  if (state.title) env.setTitle(state.title);
  open();
  const offVisible = env.visible.subscribe((on) => {
    sub?.visible(on);
    if (on) follow();
  });
  const offAccounts = env.engine.accounts.subscribe((a) => {
    if ((a.active ?? '') !== account) (account = a.active ?? ''), open();
  });
  const offSettings = env.settings.subscribe(() => (nodes.clear(), sync()));
  return () => {
    cancelAnimationFrame(frame);
    offVisible();
    offAccounts();
    offSettings();
    sub?.close();
  };
}
