// The same retained draft text and controls belong to the composer and Home.
import type { Draft } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';

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
