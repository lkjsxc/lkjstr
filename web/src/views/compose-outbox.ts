// At most 20 pending or failed drafts per composer, persisted independently of the input.
import type { Delivery, Draft, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { kv } from '../shared/storage.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { failureText } from './can.ts';
import type { ViewEnv } from './registry.ts';

export type ChannelDraft = {
  as: string;
  draft: Draft;
  error?: Failure;
  delivery?: readonly Delivery[];
};
type Box = { drafts: ChannelDraft[]; busy: Set<ChannelDraft>; listeners: Set<() => void> };
// One entry per mounted composer or unsettled send; released when both are gone.
const boxes = new Map<string, Box>();
export function createChannelOutbox(
  env: ViewEnv,
  legacy: ChannelDraft[],
  changed: () => void,
  delivery: (relays: readonly Delivery[], final: boolean) => void,
  edit: (draft: Draft) => boolean,
) {
  const key = `${env.instance}:outbox`;
  let box = boxes.get(key);
  if (!box) {
    const saved = loadViewState<{ drafts?: ChannelDraft[] }>(key);
    box = { drafts: saved.drafts ?? legacy, busy: new Set(), listeners: new Set() };
    boxes.set(key, box);
  }
  const { drafts, busy, listeners } = box;
  const el = h('div', { class: 'outbox' });
  const notify = (): void => {
    saveViewState(key, { drafts });
    for (const listener of listeners) listener();
    if (!busy.size && !listeners.size) boxes.delete(key);
  };
  const remove = (item: ChannelDraft): void => {
    const index = drafts.indexOf(item);
    if (index >= 0) drafts.splice(index, 1);
    notify();
  };
  const draw = (): void => {
    el.replaceChildren(
      ...drafts.map((item) => {
        const pending = busy.has(item);
        const action = (
          label: 'compose.retry' | 'compose.edit' | 'compose.drop',
          run: () => void,
        ) => h('button', { class: 'btn', disabled: pending, onclick: run }, t(label));
        return h(
          'div',
          { class: 'cresult' },
          h('div', { class: 'text' }, item.draft.text),
          ...(item.draft.media ?? []).map((m) =>
            h('a', { href: m.url, target: '_blank', rel: 'noreferrer' }, m.url),
          ),
          h(
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
                t('compose.sending', {
                  ok: item.delivery.filter((r) => r.state === 'ok').length,
                  all: item.delivery.length,
                }),
              )
            : null,
          h(
            'div',
            { class: 'actions' },
            action('compose.retry', () => void send(item)),
            action('compose.edit', () => {
              if (edit(item.draft)) remove(item);
            }),
            action('compose.drop', () => remove(item)),
          ),
        );
      }),
    );
    changed();
  };
  async function send(item: ChannelDraft): Promise<void> {
    if (busy.has(item)) return;
    busy.add(item);
    notify();
    const r = await env.engine.act(
      { a: 'publish', as: item.as, what: { k: 'note', draft: item.draft } },
      {
        delivery: (relays) => {
          item.delivery = relays;
          notify();
        },
      },
    );
    busy.delete(item);
    if (r.ok) {
      delivery(r.delivery ?? [], true);
      remove(item);
    } else {
      item.error = r.error;
      notify();
    }
  }
  listeners.add(draw);
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
      if (!kv.persist(`view:${key}`, { drafts })) {
        drafts.pop();
        return false;
      }
      notify();
      return true;
    },
    publish(draft: Draft) {
      const item = { as: env.engine.me(), draft };
      drafts.push(item);
      if (!kv.persist(`view:${key}`, { drafts })) {
        drafts.pop();
        return false;
      }
      notify(); // durable before the caller clears the field
      void send(item);
      return true;
    },
    dispose() {
      listeners.delete(draw);
      if (!busy.size) boxes.delete(key);
    },
  };
}
