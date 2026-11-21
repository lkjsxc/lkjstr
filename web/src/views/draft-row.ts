// The same retained draft text and controls belong to the composer and Home.
import type { Draft, Segment } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

/** A waiting or failed draft's text, its chosen people already the links the published note will show. */
export function draftText(draft: Draft, env: ViewEnv): HTMLElement {
  const list: Segment[] = [];
  let at = 0;
  for (const m of [...(draft.mentions ?? [])].sort((a, b) => a.start - b.start)) {
    if (m.start < at || draft.text.slice(m.start, m.end) !== m.label) continue;
    if (m.start > at) list.push({ k: 'text', text: draft.text.slice(at, m.start) });
    list.push({ k: 'mention', pubkey: m.pubkey, name: m.label.replace(/^@/, '') });
    at = m.end;
  }
  if (at < draft.text.length) list.push({ k: 'text', text: draft.text.slice(at) });
  return h('div', { class: 'text' }, ...segments(list, env));
}

export function draftMedia(draft: Draft): HTMLElement[] {
  return (draft.media ?? []).map((media) =>
    h('a', { href: media.url, target: '_blank', rel: 'noreferrer' }, media.url),
  );
}

export function draftButtons(
  busy: boolean,
  retry: () => void,
  edit: () => void,
  discard: () => void,
): HTMLElement {
  const button = (key: Key, run: () => void): HTMLElement =>
    h('button', { class: 'btn', disabled: busy, onclick: run }, t(key));
  return h(
    'div',
    { class: 'actions' },
    button('compose.retry', retry),
    button('compose.edit', edit),
    button('compose.drop', discard),
  );
}
