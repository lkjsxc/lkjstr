// M2 coordinates private snapshots with a bounded note window and the same anchor keeper as an ordinary feed.
import type { Account, DmMessage } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { pressed, typing } from '../shared/keys.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { createDmCompose } from './dm-compose.ts';
import { createDmDraftPool } from './dm-draft-pool.ts';
import { createDmHead } from './dm-head.ts';
import { dmEnd, dmPeople } from './dm-parts.ts';
import { createDmStream } from './dm-stream.ts';
import { dmVisible, mountDmSurface } from './dm-surface.ts';
import { createDmWindow } from './dm-window.ts';
import { createKeeper, type Place } from './feed-place.ts';
import type { ViewEnv } from './registry.ts';

type State = { participants?: readonly string[]; place?: Place };
export function mountMessage(el: HTMLElement, env: ViewEnv): () => void {
  const drafts = createDmDraftPool(env);
  const stop = mountDmSurface(el, env, (account) => mountConversation(el, env, account, drafts));
  return () => {
    stop();
    drafts.dispose();
  };
}
function mountConversation(
  el: HTMLElement,
  env: ViewEnv,
  account: Account,
  drafts: ReturnType<typeof createDmDraftPool>,
): () => void {
  const saved = loadViewState<State>(env.instance),
    owner = account.author.pubkey;
  const peers = [...new Set(saved.participants ?? [])].filter((key) => key !== owner).slice(0, 31);
  const list = h('div', { class: 'list dm-list' }),
    end = h('div');
  let stopped = false,
    newestSeen = '',
    marking = false,
    restoreWanted = saved.place;
  let keep: ReturnType<typeof createKeeper> | undefined,
    window: ReturnType<typeof createDmWindow> | undefined;
  const unread = new Map<string, boolean>(); // <=8000 rows, held for this visit to keep bars still
  const stream = createDmStream({ env, account: owner, peers, changed: () => draw() });
  const head = createDmHead(env, owner, peers);
  const compose = createDmCompose({
    env,
    account,
    peers,
    drafts,
    known: stream.known,
    changed: () => keep?.put(),
  });
  const desk = h('div', { class: 'cdesk' }, head.el, compose.el);
  el.replaceChildren(desk, list, end);
  const seen = async (): Promise<void> => {
    const message = stream.rows()[0],
      room = stream.room();
    if (stopped || marking || !dmVisible(env) || !room || !message || message.id === newestSeen)
      return;
    const node = window?.node(message.id),
      bounds = node?.getBoundingClientRect(),
      viewport = el.getBoundingClientRect();
    if (!bounds || bounds.bottom <= viewport.top || bounds.top >= viewport.bottom) return;
    marking = true;
    const acknowledged = stream.rows().map((row) => row.id);
    const result = await env.engine.act({ a: 'dm.seen', as: owner, conversation: room });
    marking = false;
    if (!stopped && result.ok) {
      newestSeen = message.id;
      stream.ackSeen(acknowledged);
      requestAnimationFrame(() => void seen());
    }
  };
  window = createDmWindow({
    el,
    list,
    env,
    reply: (message) => compose.reply(message),
    hold: () => keep?.hold() ?? (() => {}),
    moved: () => void seen(),
  });
  keep = createKeeper({
    el,
    list,
    saved: saved.place,
    active: () => dmVisible(env),
    node: (id) => window?.node(id),
    anchors: (key) => !!stream.known(key),
    save: (place) => saveViewState(env.instance, { participants: peers, place }),
  });
  function draw(): void {
    if (stopped || !window) return;
    const snapshot = stream.snapshot(),
      rows = stream.rows(),
      people = dmPeople(snapshot, account);
    const held = keep?.hold();
    head.update(people);
    if (snapshot) compose.update(snapshot, people);
    const currentIds = new Set(rows.map((m) => m.id));
    for (const id of unread.keys()) if (!currentIds.has(id)) unread.delete(id);
    const marked = rows.map((message): DmMessage => {
      if (!unread.has(message.id)) unread.set(message.id, message.unread);
      return { ...message, unread: unread.get(message.id) ?? false };
    });
    window.draw(marked, people);
    end.replaceChildren(dmEnd(snapshot, rows.length, stream.loading(), stream.open));
    if (restoreWanted && window.show(restoreWanted.key)) {
      keep?.set(restoreWanted);
      restoreWanted = undefined;
    }
    held?.();
    if (restoreWanted && snapshot?.more && !stream.loading()) queueMicrotask(() => stream.more());
    requestAnimationFrame(() => {
      if (!stopped) {
        void seen();
        older();
      }
    });
  }
  function older(): void {
    if (stopped || !dmVisible(env) || stream.loading()) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 160) stream.more();
  }
  const scroll = (): void => {
    window?.scroll();
    keep?.read();
    void seen();
    older();
  };
  const key = (event: KeyboardEvent): void => {
    if (typing(event) || !dmVisible(env)) return;
    if (pressed(event, 'next')) {
      event.preventDefault();
      window?.move(1);
    } else if (pressed(event, 'prev')) {
      event.preventDefault();
      window?.move(-1);
    } else if (pressed(event, 'reply')) {
      const selected = window?.selected();
      if (selected) {
        event.preventDefault();
        compose.reply(selected);
      }
    } else if (pressed(event, 'top')) {
      event.preventDefault();
      const first = stream.rows()[0];
      if (first) window?.show(first.id);
      keep?.forget();
    }
  };
  let wasVisible = dmVisible(env);
  const visibility = (): void => {
    const now = dmVisible(env);
    if (now && !wasVisible) {
      unread.clear();
      draw();
      keep?.put();
    }
    wasVisible = now;
    if (now) void seen();
  };
  el.addEventListener('scroll', scroll, { passive: true });
  el.addEventListener('keydown', key);
  document.addEventListener('visibilitychange', visibility);
  const offs = [
    env.visible.subscribe(visibility),
    env.settings.subscribe(() => {
      window?.clear();
      draw();
    }),
  ];
  return () => {
    stopped = true;
    offs.forEach((off) => off());
    document.removeEventListener('visibilitychange', visibility);
    el.removeEventListener('scroll', scroll);
    el.removeEventListener('keydown', key);
    keep?.dispose();
    compose.dispose();
    head.dispose();
    stream.dispose();
    window?.dispose();
    unread.clear();
  };
}
