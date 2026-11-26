// A profile's event choices scroll with its header. The saved query is sent on the first open;
// the controls appear when the engine reports readiness.
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
  state: { show?: string; profileReposts?: boolean };
  save(): void;
  reopen(): void;
}): {
  remember(): void;
  seat(header: HTMLElement | undefined, row: Row | undefined): void;
  query(): Partial<Query>;
  dispose(): void;
} {
  const bar = h('div', { class: 'pkinds', role: 'tablist' });
  const includesReposts = (): boolean => o.state.profileReposts !== false;
  const repostButtons = [true, false].map((value) =>
    h(
      'button',
      {
        class: 'chip',
        onclick: () => {
          if (includesReposts() === value) return;
          o.state.profileReposts = value ? undefined : false;
          o.save();
          paintReposts();
          o.reopen();
        },
      },
      t(value ? 'filter.show' : 'filter.hide'),
    ),
  );
  const paintReposts = (): void => {
    repostButtons.forEach((button, index) => {
      const selected = (index === 0) === includesReposts();
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };
  paintReposts();
  const reposts = h(
    'div',
    { class: 'prow', role: 'group', 'aria-label': t('filter.reposts') },
    h('span', { class: 'muted', 'aria-hidden': true }, t('filter.reposts')),
    h('div', { class: 'seg-ctl' }, repostButtons),
  );
  const seatReposts = (): void => {
    if (kindOf(o.state.show) !== 'posts') reposts.remove();
    else if (reposts.parentElement !== bar.parentElement) bar.before(reposts);
  };
  let on = rich(o.env.engine);
  let left = 0;
  let reveal = true;
  let restore = false;
  let frame = 0;
  const position = (): void => {
    if ((!reveal && !restore) || !bar.isConnected || !bar.clientWidth) return;
    const selected = bar.querySelector<HTMLElement>('.pkind.on');
    if (!selected) return;
    if (reveal) {
      const x =
        selected.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft;
      if (x < bar.scrollLeft || x + selected.offsetWidth > bar.scrollLeft + bar.clientWidth)
        bar.scrollLeft = Math.max(0, x - (bar.clientWidth - selected.offsetWidth) / 2);
    } else bar.scrollLeft = left;
    left = bar.scrollLeft;
    reveal = restore = false;
  };
  const schedule = (): void => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        position();
      });
  };
  const remember = (): void => {
    if (!reveal && !restore && bar.isConnected && bar.clientWidth) left = bar.scrollLeft;
  };
  bar.addEventListener('scroll', remember);
  // A detached or hidden first seating keeps its reveal intent until it has a measurable width.
  const resized = new ResizeObserver(() => {
    if (bar.clientWidth) position();
    else restore = true;
  });
  resized.observe(bar);
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
              reveal = true;
              o.save();
              draw();
              seatReposts();
              o.reopen();
              schedule();
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
    remember,
    seat(header, row) {
      if (!on || !header || row?.kind !== 'profile') {
        reposts.remove();
        return void bar.remove();
      }
      if (bar.parentElement !== header) {
        header.append(bar);
        // Profile counts replace their header. Restore its scroll without reselecting the current kind.
        restore = true;
        position();
      }
      seatReposts();
      if (reveal || restore) schedule();
    },
    query: () => {
      const show = kindOf(o.state.show);
      return { show, ...(show === 'posts' && !includesReposts() ? { reposts: false } : {}) };
    },
    dispose() {
      off();
      resized.disconnect();
      bar.removeEventListener('scroll', remember);
      if (frame) cancelAnimationFrame(frame);
    },
  };
}
