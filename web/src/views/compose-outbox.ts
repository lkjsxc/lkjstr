// At most 20 pending or failed channel drafts per composer, persisted with its tab.
import type { Delivery, Draft, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { failureText } from './can.ts';
import type { ViewEnv } from './registry.ts';

export type ChannelDraft = { as: string; draft: Draft };
export function createChannelOutbox(
  env: ViewEnv,
  drafts: ChannelDraft[],
  changed: () => void,
  delivery: (relays: readonly Delivery[], final: boolean) => void,
) {
  const el = h('div');
  const busy = new Set<ChannelDraft>(); // bound: the retained drafts
  const errors = new Map<ChannelDraft, Failure | undefined>(); // bound: failed drafts
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
              changed();
              draw();
            },
          },
          t('compose.drop'),
        );
        return h(
          'div',
          { class: 'cresult' },
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
    draw();
    const r = await env.engine.act(
      {
        a: 'publish',
        as: item.as,
        what: { k: 'note', draft: item.draft },
      },
      { delivery: (relays) => delivery(relays, false) },
    );
    busy.delete(item);
    if (r.ok) delivery(r.delivery ?? [], true);
    if (r.ok) drafts.splice(drafts.indexOf(item), 1), errors.delete(item);
    else errors.set(item, r.error);
    changed();
    draw();
  }
  draw();
  return {
    el,
    full: () => drafts.length >= 20,
    publish(draft: Draft) {
      const item = { as: env.engine.me(), draft };
      drafts.push(item);
      changed();
      void send(item);
    },
  };
}
