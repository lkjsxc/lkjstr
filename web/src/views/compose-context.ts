// The line over a draft that says what it answers or quotes, with a way to drop that.
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';

export type Ref = { name: string; text: string };

export const contextLine = (
  label: Key,
  ref: Ref | undefined,
  clear: () => void,
): HTMLElement | null =>
  ref
    ? h(
        'div',
        { class: 'cctx' },
        h('span', { class: 'muted clip' }, t(label, { name: ref.name }), ' ', ref.text),
        h(
          'button',
          {
            class: 'x',
            title: t('compose.drop'),
            'aria-label': t('compose.drop'),
            onclick: clear,
          },
          '×',
        ),
      )
    : null;
