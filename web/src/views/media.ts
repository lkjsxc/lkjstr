// The pictures and video of one note, as a new tab right after the one being read, in the same tile (owner,
// 2026-11-22). A picture is zoomed and moved like a map (zoom.ts), its percentage a handle (zoom-handle.ts); arrows
// go to the next and the previous; Escape closes the tab, which brings back the tab it came from where it was, and
// gives the keyboard back to the picture. A video or a sound has the browser's controls and the player's keys
// (`player.ts`).
import type { Media } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { pressed } from '../shared/keys.ts';
import { loadImage, mediaHost, mediaSource } from '../shared/media-source.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { copy } from './parts.ts';
import { createPlayer, type Player } from './player.ts';
import type { ViewEnv } from './registry.ts';
import { type Zoom, type ZoomPosition, zoomable } from './zoom.ts';
import { zoomHandle } from './zoom-handle.ts';

/** A scale as the handle says it: whole percent, and tenths under 10%. */
const percent = (s: number): string =>
  `${s < 0.1 ? (Math.round(s * 1000) / 10).toFixed(1) : Math.round(s * 100)}%`;

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
  const offHandle = zoomHandle(scale, () => zoom);
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
    const many = list.length > 1;
    prev.hidden = next.hidden = count.hidden = !many;
    prev.disabled = index === 0;
    next.disabled = index === list.length - 1;
    count.textContent = `${index + 1} / ${list.length}`;
    alt.textContent = alt.title = m.alt ?? '';
    scale.hidden = m.type !== 'image';
    original.href = m.url;
    const failed = (): void => {
      zoom?.dispose();
      zoom = undefined;
      scale.hidden = true;
      missing(m.type === 'image' ? mediaHost(m.url) : t('media.failed'), m);
    };
    if (!mediaSource(m.url)) failed();
    else if (m.type === 'image') {
      const img = h('img', { alt: m.alt ?? '', draggable: false, decoding: 'async' });
      replaceChildren(stage, img);
      const at = index; // the picture's own place, also when it is left for another
      zoom = zoomable(
        stage,
        img,
        m,
        {
          scale: (s) => void (scale.textContent = percent(s)),
          flick: (dir) => go(index + dir),
          changed: (position) => {
            state.zoom = { ...state.zoom, [at]: position };
            saveViewState(env.instance, state);
          },
        },
        state.zoom?.[at],
      );
      loadImage(
        img,
        m.url,
        () => {
          if (img.parentElement === stage) failed();
        },
        undefined,
        { class: 'media', slot: 'media-view', view: env.instance, lane: 'L0' },
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
        failed: () => list[index] === m && failed(),
      });
      replaceChildren(stage, player.el);
    }
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
    if (pressed(e, 'viewerClose')) e.preventDefault(), env.close();
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
    offHandle();
    zoom?.dispose();
    player?.dispose();
    el.removeEventListener('keydown', key, true);
  };
}
