// At most 20 pending or failed drafts per composer, persisted with its tab.
import type { Delivery, Draft, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { failureText } from './can.ts';
import type { ViewEnv } from './registry.ts';

export type ChannelDraft = { as: string; draft: Draft };
type Watch = {
  changed(): void;
  draw(): void;
  delivery(relays: readonly Delivery[], final: boolean, error?: Failure): void;
};
type Sending = {
  drafts: ChannelDraft[];
  busy: Set<ChannelDraft>;
  errors: Map<ChannelDraft, Failure | undefined>;
  watchers: Set<Watch>;
};
// One per mounted composer or a composer with an in-flight request; disposed and settled entries are released.
const active = new Map<string, Sending>();
export function createChannelOutbox(
  env: ViewEnv,
  initial: ChannelDraft[],
  changed: () => void,
  delivery: (relays: readonly Delivery[], final: boolean, error?: Failure) => void,
) {
  const el = h('div');
  const pending = active.get(env.instance) ?? {
    drafts: initial,
    busy: new Set<ChannelDraft>(),
    errors: new Map<ChannelDraft, Failure | undefined>(),
    watchers: new Set<Watch>(),
  };
  active.set(env.instance, pending);
  const { drafts, busy, errors, watchers } = pending;
  const release = (): void => {
    if (!watchers.size && !busy.size) active.delete(env.instance);
  };
  const notify = (): void => {
    if (!watchers.size) {
      const saved = loadViewState(env.instance);
      if (Object.keys(saved).length) saveViewState(env.instance, { ...saved, outbox: drafts });
    }
    for (const w of watchers) {
      w.changed();
      w.draw();
    }
    release();
  };
  const delivered: Watch['delivery'] = (...args) => {
    for (const w of watchers) w.delivery(...args);
  };
  const draw = (): void => {
    el.replaceChildren(
      ...drafts.map((item) => {
        const pending = busy.has(item);
        const retry = h(
          'button',
          { class: 'btn', disabled: pending, onclick: () => void send(item) },
          t('compose.retry'),
        );
        const drop = h(
          'button',
          {
            class: 'btn',
            disabled: pending,
            onclick: () => {
              drafts.splice(drafts.indexOf(item), 1);
              errors.delete(item);
              notify();
            },
          },
          t('compose.drop'),
        );
        return h(
          'div',
          { class: 'cresult cdraft' },
          h('div', null, item.draft.text),
          ...(item.draft.media ?? []).map((m) =>
            h('a', { href: m.url, target: '_blank', rel: 'noreferrer' }, m.url),
          ),
          h(
            'div',
            { class: pending ? 'muted' : 'error' },
            pending
              ? t('compose.pending')
              : errors.has(item)
                ? failureText(errors.get(item))
                : t('compose.retained'),
          ),
          retry,
          drop,
        );
      }),
    );
  };
  async function send(item: ChannelDraft): Promise<void> {
    if (busy.has(item)) return;
    busy.add(item);
    delivered([], false);
    notify();
    const r = await env.engine.act(
      {
        a: 'publish',
        as: item.as,
        what: { k: 'note', draft: item.draft },
      },
      { delivery: (relays) => delivered(relays, false) },
    );
    busy.delete(item);
    if (r.ok) delivered(r.delivery ?? [], true);
    if (r.ok) drafts.splice(drafts.indexOf(item), 1), errors.delete(item);
    else {
      errors.set(item, r.error);
      delivered([], true, r.error ?? { code: 'internal' });
    }
    notify();
  }
  const watch = { changed, draw, delivery };
  watchers.add(watch);
  draw();
  return {
    el,
    drafts,
    dispose() {
      watchers.delete(watch);
      release();
    },
    full: () => drafts.length >= 20,
    publish(draft: Draft) {
      const item = { as: env.engine.me(), draft };
      drafts.push(item);
      notify();
      void send(item);
    },
  };
}
