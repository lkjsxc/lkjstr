// Which of a person's events their profile lists: posts, replies, reposts, reactions or media, as tabs under the
// header (they scroll away with it). Saved with the tab. An engine older than protocol 3 lists what it always
// did, and the tabs are not drawn.
import type { Query, Row } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { rich } from './can.ts';
import type { ViewEnv } from './registry.ts';

export const PROFILE_KINDS = [
  'posts',
  'replies',
  'reposts',
  'reactions',
  'media',
  'articles',
  'lists',
  'all',
] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];
const kindOf = (show: string | undefined): ProfileKind =>
  PROFILE_KINDS.find((k) => k === show) ?? 'posts';

export function mountProfileKinds(o: {
  env: ViewEnv;
  state: { show?: string };
  save(): void;
  reopen(): void;
}): {
  seat(header: HTMLElement | undefined, row: Row | undefined): void;
  query(): Partial<Query>;
  dispose(): void;
} {
  const bar = h('div', { class: 'pkinds', role: 'tablist' });
  let on = rich(o.env.engine);
  const keepSelectedVisible = (): void => {
    const selected = bar.querySelector<HTMLElement>('.pkind.on');
    if (!selected || !bar.clientWidth) return;
    const x =
      selected.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft;
    if (x < bar.scrollLeft || x + selected.offsetWidth > bar.scrollLeft + bar.clientWidth)
      bar.scrollLeft = Math.max(0, x - (bar.clientWidth - selected.offsetWidth) / 2);
  };
  const draw = (): void =>
    bar.replaceChildren(
      ...PROFILE_KINDS.map((k) =>
        h(
          'button',
          {
            class: k === kindOf(o.state.show) ? 'pkind on' : 'pkind',
            role: 'tab',
            'aria-selected': k === kindOf(o.state.show),
            onclick: (e) => {
              e.stopPropagation();
              if (k === kindOf(o.state.show)) return;
              o.state.show = k;
              o.save();
              draw();
              requestAnimationFrame(keepSelectedVisible);
              o.reopen();
            },
          },
          t(`pkind.${k}`),
        ),
      ),
    );
  draw();
  const off = o.env.engine.info.subscribe(() => {
    if (on === rich(o.env.engine)) return;
    on = !on;
    o.reopen();
  });
  return {
    seat(header, row) {
      if (!on || !header || row?.kind !== 'profile') return void bar.remove();
      if (bar.parentElement !== header) header.append(bar);
      requestAnimationFrame(keepSelectedVisible);
    },
    query: () => (on ? { show: kindOf(o.state.show) } : {}),
    dispose: off,
  };
}
