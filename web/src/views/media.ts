// The pictures and video of one note, laid over the tile that was being read (owner, 2026-11-22: never in another
// tile). The list under it is not touched, so closing it leaves the reader exactly where they were. A picture can be
// zoomed and panned; arrows go to the next and the previous; Escape or × closes it and gives the keyboard back to
// the picture that was pressed. A video or a sound has the browser's controls and the player's keys (`player.ts`).
import type { Media } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { pressed } from '../shared/keys.ts';
import { copy } from './parts.ts';
import { createPlayer, type Player } from './player.ts';
import type { ViewEnv } from './registry.ts';
import { type Zoom, type ZoomPosition, zoomable } from './zoom.ts';

type MediaState = {
  /** The file that was pressed has been started once: a file gone back to never starts playing by itself. */
  played?: boolean;
  /** Seconds into the video or sound at `index`. */
  at?: number;
  zoom?: Record<string, ZoomPosition>;
};

/** Opens `list` at `start` over the tab of `env`; `from` (the pressed picture) gets the keyboard back on close. */
export function openMedia(
  env: ViewEnv,
  from: HTMLElement,
  list: readonly Media[],
  start: number,
): void {
  const el = h('div', { class: 'cover mview', role: 'dialog', 'aria-label': t('media.view') });
  const state: MediaState = {};
  let off = (): void => undefined;
  const close = (): void => {
    off();
    if (from.isConnected) from.focus({ preventScroll: true });
  };
  let index = Math.min(Math.max(0, start), Math.max(0, list.length - 1));
  let zoom: Zoom | undefined;
  let player: Player | undefined;

  const stage = h('div', { class: 'mstage' });
  const count = h('span', { class: 'mcount' });
  const alt = h('span', { class: 'malt muted clip' });
  const button = (name: IconName, label: string, run: () => void): HTMLButtonElement =>
    h('button', { class: 'icon', title: label, 'aria-label': label, onclick: run }, icon(name));
  const prev = button('left', t('media.prev'), () => go(index - 1));
  const next = button('right', t('media.next'), () => go(index + 1));
  const scale = h('button', {
    class: 'mscale',
    title: t('media.zoom'),
    'aria-label': t('media.zoom'),
  });
  scale.addEventListener('click', () => zoom?.toggle());
  const original = h(
    'a',
    {
      class: 'icon',
      target: '_blank',
      rel: 'noopener noreferrer',
      title: t('media.original'),
      'aria-label': t('media.original'),
    },
    icon('external'),
  );
  const link = button('link', t('media.copy'), () => {
    const m = list[index];
    if (m) void copy(env, m.url);
  });
  const shut = h(
    'button',
    {
      class: 'icon mclose',
      title: t('media.close'),
      'aria-label': t('media.close'),
      onclick: close,
    },
    '×',
  );

  const missing = (text: string, m?: Media): void =>
    replaceChildren(
      stage,
      h(
        'div',
        { class: 'fstate muted' },
        text,
        m
          ? h(
              'div',
              null,
              h(
                'a',
                { href: m.url, target: '_blank', rel: 'noopener noreferrer' },
                t('media.original'),
              ),
            )
          : null,
      ),
    );
  function show(): void {
    zoom?.dispose();
    zoom = undefined;
    player?.dispose();
    player = undefined;
    const m = list[index];
    if (!m) return missing(t('media.gone'));
    stage.className = `mstage k-${m.type}`;
    stage.style.background = '';
    if (m.type === 'image') {
      const img = h('img', { src: m.url, alt: m.alt ?? '', draggable: false, decoding: 'async' });
      replaceChildren(stage, img);
      zoom = zoomable(
        stage,
        img,
        m,
        {
          scale: (s) => void (scale.textContent = `${Math.round(s * 100)}%`),
          flick: (dir) => go(index + dir),
          changed: (position) => void (state.zoom = { ...state.zoom, [index]: position }),
        },
        state.zoom?.[index],
      );
    } else {
      player = createPlayer(m, {
        at: state.at,
        start: !state.played,
        position: (seconds) => void (list[index] === m && (state.at = seconds)),
        failed: () => list[index] === m && missing(t('media.failed'), m),
      });
      replaceChildren(stage, player.el);
    }
    const many = list.length > 1;
    prev.hidden = next.hidden = count.hidden = !many;
    prev.disabled = index === 0;
    next.disabled = index === list.length - 1;
    count.textContent = `${index + 1} / ${list.length}`;
    alt.textContent = alt.title = m.alt ?? '';
    scale.hidden = m.type !== 'image';
    original.href = m.url;
    state.played = true;
  }
  function go(to: number): void {
    if (to < 0 || to >= list.length || to === index) return;
    index = to;
    state.at = 0;
    show();
  }

  const key = (e: KeyboardEvent): void => {
    // A focused button of the bar keeps its own Space and Enter.
    if ((e.key === ' ' || e.key === 'Enter') && (e.target as Element).closest?.('.mbar')) return;
    if (pressed(e, 'viewerClose')) close();
    else if (pressed(e, 'viewerPrev')) go(index - 1);
    else if (pressed(e, 'viewerNext')) go(index + 1);
    else if (player?.key(e)) void 0;
    else if (pressed(e, 'viewerLeft')) go(index - 1);
    else if (pressed(e, 'viewerRight')) go(index + 1);
    else if (pressed(e, 'zoomIn')) zoom?.by(1.25);
    else if (pressed(e, 'zoomOut')) zoom?.by(0.8);
    else if (pressed(e, 'zoomFit')) zoom?.toggle();
    else return;
    e.preventDefault();
    e.stopPropagation(); // the browser's player would act on the same key a second time
  };
  el.addEventListener('keydown', key, true);
  el.tabIndex = -1;
  el.replaceChildren(
    stage,
    h('div', { class: 'mbar' }, prev, count, next, alt, scale, original, link, shut),
  );
  show();
  // Out of view (another tab in front), a playing file stops.
  const hidden = env.visible.subscribe((on) => void (on || player?.pause()));
  off = env.cover(el, () => {
    hidden();
    zoom?.dispose();
    player?.dispose();
  });
  el.focus({ preventScroll: true });
}
