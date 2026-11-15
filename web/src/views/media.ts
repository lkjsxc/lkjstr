// The pictures and video of one note, as a tab beside what was being read. A picture can be zoomed and panned;
// arrows go to the next and the previous; Escape closes the tab and gives the keyboard back to the note. A video
// or a sound has the browser's controls and the player's keys (`player.ts`).
import type { Media } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { pressed } from '../shared/keys.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { copy } from './parts.ts';
import { createPlayer, type Player } from './player.ts';
import type { ViewEnv } from './registry.ts';
import { type Zoom, type ZoomPosition, zoomable } from './zoom.ts';

export type MediaState = {
  media?: readonly Media[];
  index?: number;
  title?: string;
  /** The file that was pressed has been started once: a restored or redrawn tab never starts playing by itself. */
  played?: boolean;
  /** Seconds into the video or sound at `index`. */
  at?: number;
  zoom?: Record<string, ZoomPosition>;
};

export function mountMedia(el: HTMLElement, env: ViewEnv): () => void {
  const state: MediaState = loadViewState<MediaState>(env.instance);
  const list = state.media ?? [];
  let index = Math.min(Math.max(0, state.index ?? 0), Math.max(0, list.length - 1));
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
          changed: (position) => {
            state.zoom = { ...state.zoom, [index]: position };
            saveViewState(env.instance, state);
          },
        },
        state.zoom?.[index],
      );
    } else {
      player = createPlayer(m, {
        at: state.at,
        start: !state.played,
        position: (seconds) => {
          if (list[index] !== m || state.at === seconds) return;
          state.at = seconds;
          saveViewState(env.instance, state);
        },
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
    state.index = index;
    state.played = true;
    saveViewState(env.instance, state);
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
    if (pressed(e, 'viewerClose')) env.close();
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
  el.classList.add('mview');
  el.tabIndex = -1;
  el.replaceChildren(
    stage,
    h('div', { class: 'mbar' }, prev, count, next, alt, scale, original, link),
  );
  show();
  if (state.title) env.setTitle(state.title);
  // In front: the keyboard is here, so the arrows and Escape work at once.
  const front = (on: boolean): void => {
    if (on) el.focus({ preventScroll: true });
    else player?.pause();
  };
  const off = env.visible.subscribe(front);
  return () => {
    off();
    zoom?.dispose();
    player?.dispose();
    el.removeEventListener('keydown', key, true);
  };
}
