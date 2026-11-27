// At most 20 pending or failed drafts per composer, persisted independently of the input.
import type { Delivery, Draft, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { kv } from '../shared/storage.ts';
import { loadViewState } from '../shared/view-state.ts';
import {
  announceDefaults,
  boxes,
  type ChannelDraft,
  followSignedNote,
  outboxRow,
  type Watch,
} from './compose-outbox-state.ts';
import { type HomeDraft, hasHomeDraft, removeHomeDraft, showHomeDraft } from './home-drafts.ts';
import { ownPublished } from './own-published.ts';
import type { ViewEnv } from './registry.ts';
import { asking, waitKey } from './send-state.ts';

export type { ChannelDraft } from './compose-outbox-state.ts';

export function createChannelOutbox(
  env: ViewEnv,
  legacy: ChannelDraft[],
  changed: () => void,
  delivery: Watch['delivery'],
  edit: (draft: Draft) => boolean,
) {
  const key = `${env.instance}:outbox`;
  const saved = loadViewState<{ id: string; drafts: ChannelDraft[] }>(key);
  let box = boxes.get(key);
  if (!box || box.id !== saved.id) {
    box = {
      id: crypto.randomUUID(),
      drafts: saved.drafts ?? legacy,
      busy: new Set(),
      waiting: new Set(),
      listeners: new Set(),
      watches: new Map(),
      noteWatches: new Map(),
    };
    boxes.set(key, box);
    kv.set(`view:${key}`, { id: box.id, drafts: box.drafts });
  }
  const currentBox = box;
  const { id, drafts, busy, waiting, listeners } = currentBox;
  const release = (): void => {
    if (busy.size || listeners.size || drafts.some((item) => hasHomeDraft(item.homeKey))) return;
    for (const watch of currentBox.noteWatches.values()) watch();
    currentBox.noteWatches.clear();
    for (const watch of currentBox.watches.values()) watch.abort();
    currentBox.watches.clear();
    if (boxes.get(key) === box) boxes.delete(key);
  };
  const el = h('div', { class: 'outbox' });
  const notify = (): void => {
    // A retired tab may still have an unsettled send; it must not recreate or overwrite a fresh tab.
    if (loadViewState<{ id: string }>(key).id === id) kv.set(`view:${key}`, { id, drafts });
    for (const listener of listeners) listener.draw();
    release();
  };
  const delivered: Watch['delivery'] = (...args) => {
    for (const listener of listeners) listener.delivery(...args);
  };
  const remove = (item: ChannelDraft): void => {
    const index = drafts.indexOf(item);
    if (index >= 0) drafts.splice(index, 1);
    currentBox.noteWatches.get(item)?.();
    currentBox.noteWatches.delete(item);
    removeHomeDraft(item.homeKey);
    notify();
  };
  const discard = (item: ChannelDraft): void => {
    if (item.noteKey && item.notePhase !== 'refused' && currentBox.noteWatches.has(item)) {
      item.discarding = true;
      env.engine.noteOutbox?.discard(item.noteKey);
    } else remove(item);
  };
  const draw = (): void => {
    el.replaceChildren(
      ...drafts.map((item) => {
        const pending = busy.has(item);
        const who = waiting.has(item) ? waitKey(asking(signerOf(item))) : undefined;
        return outboxRow(item, env, pending, who, {
          retry: () => void send(item),
          edit: () => {
            if (edit(item.draft)) remove(item);
          },
          discard: () => discard(item),
        });
      }),
    );
    changed();
  };
  const accountOf = (item: ChannelDraft) =>
    env.engine.accounts.get().accounts.find((a) => a.author.pubkey === item.as);
  const signerOf = (item: ChannelDraft) => accountOf(item)?.signer;
  const homeEntry = (item: ChannelDraft): HomeDraft | undefined => {
    const account = accountOf(item);
    if (item.draft.channel || !account) return;
    return {
      key: (item.homeKey ??= crypto.randomUUID()),
      at: (item.homeAt ??= Date.now()),
      draft: item.draft,
      author: account.author,
      asks: asking(account.signer),
      retry: () => void send(item),
      discard: () => remove(item),
      release,
    };
  };
  async function send(item: ChannelDraft): Promise<void> {
    if (busy.has(item) || item.noteKey) return;
    if (!item.draft.channel && !item.draft.longForm && env.engine.noteOutbox) {
      item.noteKey = crypto.randomUUID();
      if (!kv.persist(`view:${key}`, { id, drafts })) {
        item.noteKey = undefined;
        item.error = { code: 'internal' };
        notify();
        return;
      }
    }
    busy.add(item);
    followSignedNote(item, currentBox, env, { remove, notify, delivered });
    // Another post while this one is unsettled keeps both counts current; settled ones nobody shows are let go.
    for (const [settled, old] of currentBox.watches)
      if (settled === item || !drafts.includes(settled))
        old.abort(), currentBox.watches.delete(settled);
    const watch = new AbortController();
    currentBox.watches.set(item, watch);
    currentBox.latest = item;
    item.signed = item.error = item.delivery = undefined;
    const pressed = performance.now();
    let sentMs: number | undefined;
    let entry = homeEntry(item);
    if (entry) showHomeDraft(entry);
    const asks =
      entry && asking(signerOf(item))
        ? setTimeout(() => {
            if (item.signed) return;
            waiting.add(item);
            if (entry) showHomeDraft((entry = { ...entry, waiting: true }));
            notify();
          }, 10000)
        : undefined;
    let final = false;
    const show = (relays: readonly Delivery[], settled: boolean, error?: Failure): void => {
      if (settled && sentMs === undefined && relays.some((r) => r.state === 'ok'))
        sentMs = performance.now() - pressed;
      if (currentBox.latest === item && !watch.signal.aborted)
        delivered(relays, settled, error, item.signed, sentMs);
    };
    show([], false);
    notify();
    const r = await env.engine.act(
      { a: 'publish', as: item.as, what: { k: 'note', draft: item.draft, noteKey: item.noteKey } },
      {
        signed(id) {
          clearTimeout(asks);
          item.signed = id;
          waiting.delete(item);
          if (entry) showHomeDraft((entry = { ...entry, signed: id }));
          notify();
        },
        fallback() {
          announceDefaults(env);
        },
        deliverySignal: watch.signal,
        delivery: (relays) => {
          if (watch.signal.aborted) return;
          item.delivery = relays;
          if (!item.noteKey || !final || relays.some((r) => r.state === 'ok')) show(relays, final);
          if (final && relays.some((r) => r.state === 'ok')) {
            if (!item.draft.channel) ownPublished(item.as);
            remove(item);
          }
          notify();
        },
      },
    );
    clearTimeout(asks);
    busy.delete(item);
    waiting.delete(item);
    const durable = item.noteKey && item.signed;
    item.signed ??= r.id;
    if (!drafts.includes(item)) return;
    if (durable && !r.ok) {
      item.notePhase ??= 'retrying';
      if (item.notePhase === 'sending') item.notePhase = 'retrying';
      item.delivery = r.delivery;
      final = true;
      removeHomeDraft(item.homeKey);
      if (currentBox.latest === item)
        delivered(r.delivery ?? [], true, undefined, item.signed, undefined, item.attempts ?? 1);
      notify();
      return;
    }
    if (item.noteKey && !durable && r.error?.code !== 'offline') {
      currentBox.noteWatches.get(item)?.();
      currentBox.noteWatches.delete(item);
      item.noteKey = undefined;
    }
    if (
      entry &&
      r.error &&
      ((!entry.signed && !r.id) ||
        r.error.code === 'relay-unreachable' ||
        r.error.code === 'no-relays')
    ) {
      showHomeDraft({ ...entry, failure: r.error });
    } else removeHomeDraft(item.homeKey);
    final = true;
    if (!item.draft.channel && (r.ok || r.delivery?.some((route) => route.state === 'ok')))
      ownPublished(item.as);
    if (r.ok) {
      show(r.delivery ?? [], true);
      remove(item);
    } else {
      item.delivery = r.delivery;
      item.error = r.error;
      if (r.delivery?.length) show(r.delivery, true);
      else show([], true, r.error ?? { code: 'internal' });
      notify();
    }
  }
  const watch = { draw, delivery };
  listeners.add(watch);
  for (const item of drafts) {
    followSignedNote(item, currentBox, env, { remove, notify, delivered });
    if (busy.has(item) || item.signed || !item.homeKey || !item.error || item.delivery?.length)
      continue;
    const entry = homeEntry(item);
    if (entry) showHomeDraft({ ...entry, failure: item.error });
  }
  // First draw is deferred until the composer has its outbox handle.
  queueMicrotask(draw);
  return {
    el,
    draw,
    full: () => drafts.length >= 20,
    removeDraft(draft: Draft) {
      const item = drafts.find((item) => item.draft === draft);
      if (item) remove(item);
    },
    retain(draft: Draft) {
      drafts.push({ as: env.engine.me(), draft });
      if (!kv.persist(`view:${key}`, { id, drafts })) {
        drafts.pop();
        return false;
      }
      notify();
      return true;
    },
    publish(draft: Draft, saved?: () => void) {
      const item = { as: env.engine.me(), draft };
      drafts.push(item);
      if (!kv.persist(`view:${key}`, { id, drafts })) {
        drafts.pop();
        return false;
      }
      saved?.(); // Free the field before starting the action or redrawing its outbox.
      void send(item);
      return true;
    },
    dispose() {
      listeners.delete(watch);
      release();
    },
  };
}
