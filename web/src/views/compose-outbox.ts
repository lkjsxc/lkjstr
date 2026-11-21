// At most 20 pending or failed drafts per composer, persisted independently of the input.
import type { Delivery, Draft, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { kv } from '../shared/storage.ts';
import { loadViewState } from '../shared/view-state.ts';
import { draftButtons, draftMedia, draftText } from './draft-row.ts';
import { type HomeDraft, hasHomeDraft, removeHomeDraft, showHomeDraft } from './home-drafts.ts';
import { ownPublished } from './own-published.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { asking, sendClass, sendPhase, sendWords, waitKey } from './send-state.ts';

export type ChannelDraft = {
  as: string;
  draft: Draft;
  error?: Failure;
  delivery?: readonly Delivery[];
  /** The signed note's id, once the engine has it; a retry signs anew. */
  signed?: string;
  homeKey?: string;
  homeAt?: number;
};
type Watch = {
  draw(): void;
  delivery(
    relays: readonly Delivery[],
    final: boolean,
    error?: Failure,
    id?: string,
    ms?: number,
  ): void;
};
type Box = {
  id: string;
  drafts: ChannelDraft[];
  busy: Set<ChannelDraft>;
  /** Sends whose extension or remote signer has kept the reader waiting ten seconds (bound: `busy`). */
  waiting: Set<ChannelDraft>;
  listeners: Set<Watch>;
  /** Each send follows its own late answers (bound: the drafts here, plus the latest once settled). */
  watches: Map<ChannelDraft, AbortController>;
  /** The send the composer's result line follows. */
  latest?: ChannelDraft;
};
// One entry per mounted composer or unsettled send; released when both are gone.
const boxes = new Map<string, Box>();
let defaultNoticeShown = false;
function announceDefaults(env: ViewEnv): void {
  if (defaultNoticeShown) return;
  defaultNoticeShown = true;
  try {
    const key = 'lkjstr:default-relays-notice';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Keep the notice once per document when storage is denied.
  }
  toast(env.layer, t('compose.defaultRelays'));
}
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
    };
    boxes.set(key, box);
    kv.set(`view:${key}`, { id: box.id, drafts: box.drafts });
  }
  const currentBox = box;
  const { id, drafts, busy, waiting, listeners } = currentBox;
  const release = (): void => {
    if (busy.size || listeners.size || drafts.some((item) => hasHomeDraft(item.homeKey))) return;
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
    removeHomeDraft(item.homeKey);
    notify();
  };
  const draw = (): void => {
    el.replaceChildren(
      ...drafts.map((item) => {
        const pending = busy.has(item);
        const phase = sendPhase(pending, item.signed, item.delivery);
        const who = waiting.has(item) ? waitKey(asking(signerOf(item))) : undefined;
        return h(
          'div',
          { class: 'cresult cdraft', 'data-phase': phase, 'data-event': item.signed ?? null },
          draftText(item.draft, env),
          ...draftMedia(item.draft),
          h('div', { class: sendClass(phase) }, sendWords(phase, item.delivery, item.error, who)),
          draftButtons(
            pending,
            () => void send(item),
            () => {
              if (edit(item.draft)) remove(item);
            },
            () => remove(item),
          ),
        );
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
    if (busy.has(item)) return;
    busy.add(item);
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
      { a: 'publish', as: item.as, what: { k: 'note', draft: item.draft } },
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
          show(relays, final);
          if (final && relays.some((r) => r.state === 'ok')) remove(item);
          notify();
        },
      },
    );
    clearTimeout(asks);
    busy.delete(item);
    waiting.delete(item);
    item.signed ??= r.id;
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
    if (busy.has(item) || !item.homeKey || !item.error || item.delivery?.length) continue;
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
