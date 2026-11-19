// At most 20 pending or failed drafts per composer, persisted independently of the input.
import type { Delivery, Draft, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { kv } from '../shared/storage.ts';
import { loadViewState } from '../shared/view-state.ts';
import { failureText } from './can.ts';
import { draftButtons, draftMedia } from './draft-row.ts';
import { type HomeDraft, hasHomeDraft, removeHomeDraft, showHomeDraft } from './home-drafts.ts';
import { ownPublished } from './own-published.ts';
import type { ViewEnv } from './registry.ts';

export type ChannelDraft = {
  as: string;
  draft: Draft;
  error?: Failure;
  delivery?: readonly Delivery[];
  homeKey?: string;
  homeAt?: number;
};
type Watch = {
  draw(): void;
  delivery(relays: readonly Delivery[], final: boolean, error?: Failure): void;
};
type Box = {
  id: string;
  drafts: ChannelDraft[];
  busy: Set<ChannelDraft>;
  listeners: Set<Watch>;
  deliveryWatch?: AbortController;
};
// One entry per mounted composer or unsettled send; released when both are gone.
const boxes = new Map<string, Box>();
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
      listeners: new Set(),
    };
    boxes.set(key, box);
    kv.set(`view:${key}`, { id: box.id, drafts: box.drafts });
  }
  const currentBox = box;
  const { id, drafts, busy, listeners } = currentBox;
  const release = (): void => {
    if (busy.size || listeners.size || drafts.some((item) => hasHomeDraft(item.homeKey))) return;
    currentBox.deliveryWatch?.abort();
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
        const unknown =
          !pending && item.delivery?.some((r) => r.state === 'timeout' || r.state === 'pending');
        return h(
          'div',
          { class: 'cresult cdraft' },
          h('div', { class: 'text' }, item.draft.text),
          ...draftMedia(item.draft),
          unknown
            ? null
            : h(
                'div',
                { class: pending ? 'muted' : 'error' },
                pending
                  ? t('compose.pending')
                  : item.error
                    ? failureText(item.error)
                    : t('compose.retained'),
              ),
          item.delivery
            ? h(
                'div',
                null,
                t(pending ? 'compose.sending' : 'compose.delivered', {
                  ok: item.delivery.filter((r) => r.state === 'ok').length,
                  all: item.delivery.length,
                }),
              )
            : null,
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
  const homeEntry = (item: ChannelDraft): HomeDraft | undefined => {
    const account = env.engine.accounts.get().accounts.find((a) => a.author.pubkey === item.as);
    if (item.draft.channel || !account) return;
    return {
      key: (item.homeKey ??= crypto.randomUUID()),
      at: (item.homeAt ??= Date.now()),
      draft: item.draft,
      author: account.author,
      remote: account.signer === 'remote',
      retry: () => void send(item),
      discard: () => remove(item),
      release,
    };
  };
  async function send(item: ChannelDraft): Promise<void> {
    if (busy.has(item)) return;
    busy.add(item);
    currentBox.deliveryWatch?.abort();
    const watch = (currentBox.deliveryWatch = new AbortController());
    let entry = homeEntry(item);
    if (entry) showHomeDraft(entry);
    const remote = entry?.remote
      ? setTimeout(() => {
          if (entry && !entry.signed) showHomeDraft((entry = { ...entry, waiting: true }));
        }, 10000)
      : undefined;
    let final = false;
    const show: Watch['delivery'] = (...args) => {
      if (currentBox.deliveryWatch === watch) delivered(...args);
    };
    show([], false);
    notify();
    const r = await env.engine.act(
      { a: 'publish', as: item.as, what: { k: 'note', draft: item.draft } },
      {
        signed(id) {
          clearTimeout(remote);
          if (entry) showHomeDraft((entry = { ...entry, signed: id }));
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
    clearTimeout(remote);
    busy.delete(item);
    if (entry && !entry.signed && !r.id && r.error) {
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
