// The rows of a thread that are not notes (docs/interface-thread.md): the room of a note still being looked for, or
// not found; the folded earlier notes and the rest of a long branch; the reply field; skeletons of the focus and
// of replies while the relays are first asked. Each has its final height from the first frame and takes no
// keyboard selection unless it can be pressed.
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import type { ThreadPart } from './thread-plan.ts';

const bars = (n: number): HTMLElement[] =>
  Array.from({ length: n }, (_, i) => h('span', { class: `tbar${i === n - 1 ? ' short' : ''}` }));

export function threadPart(
  p: ThreadPart,
  o: { readonly say: HTMLElement; readonly press: (p: ThreadPart) => void },
): HTMLElement {
  if (p.part === 'say') return o.say;
  if (p.part === 'earlier' || p.part === 'more') {
    const label = t(p.part === 'earlier' ? 'thread.earlier' : 'thread.more', { n: p.n });
    return h(
      'button',
      {
        class: `tpart tfold ${p.part === 'earlier' ? 'th-above th-below' : 'th-step th-last'}`,
        'data-press': '',
        onclick: (e: Event) => (e.stopPropagation(), o.press(p)),
      },
      h('span', { class: 'lnk' }, label),
    );
  }
  if (p.part === 'slot') {
    const missing = p.state === 'missing';
    return h(
      'div',
      {
        class: `tpart tslot th-below${p.first ? '' : ' th-above'}${missing ? ' missing' : ''}`,
        'data-pass': '',
        role: missing ? null : 'status',
        'aria-label': missing ? null : t('thread.looking'),
      },
      h('span', { class: 'tface' }),
      missing
        ? h('span', { class: 'tsays' }, t('thread.missing'))
        : h('span', { class: 'tlines' }, bars(3)),
    );
  }
  const focus = p.of === 'focus';
  return h(
    'div',
    {
      class: `tpart tskel${focus ? ' focus' : ''}`,
      'data-pass': '',
      role: 'status',
      'aria-label': t('feed.loading'),
    },
    h('span', { class: 'tface' }),
    h('span', { class: 'tlines' }, bars(focus ? 5 : 3)),
  );
}
