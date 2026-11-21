// The same retained draft text and controls belong to the composer and Home.
import type { Draft, Segment } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { segments } from './parts.ts';
import { personAddresses } from './person-address.ts';
import type { ViewEnv } from './registry.ts';

/** Plain text with its person addresses as links to that person, as the published note's references are. */
const addresses = (text: string): Segment[] => {
  const list: Segment[] = [];
  let at = 0;
  for (const a of personAddresses(text)) {
    if (a.from > at) list.push({ k: 'text', text: text.slice(at, a.from) });
    list.push({ k: 'ref', bech32: a.bech32, text: a.text });
    at = a.from + a.text.length;
  }
  if (at < text.length) list.push({ k: 'text', text: text.slice(at) });
  return list;
};

/** A waiting or failed draft's text through the published note's inline path: its chosen people are the same mention
 * links, and its person addresses open that person. */
export function draftText(draft: Draft, env: ViewEnv): HTMLElement {
  const list: Segment[] = [];
  let at = 0;
  for (const m of [...(draft.mentions ?? [])].sort((a, b) => a.start - b.start)) {
    if (m.start < at || draft.text.slice(m.start, m.end) !== m.label) continue;
    list.push(...addresses(draft.text.slice(at, m.start)));
    list.push({ k: 'mention', pubkey: m.pubkey, name: m.label.replace(/^@/, '') });
    at = m.end;
  }
  list.push(...addresses(draft.text.slice(at)));
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
