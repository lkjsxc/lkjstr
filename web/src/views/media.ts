// The pictures and video of one note, as a tab beside what was being read. A picture can be zoomed and panned;
// arrows go to the next and the previous; Escape closes the tab and gives the keyboard back to the note.
import type { Media } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { copy } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { type Zoom, zoomable } from './zoom.ts';

export type MediaState = {
  media?: readonly Media[];
  index?: number;
  title?: string;
  /** The video has been started once: a restored tab does not start playing by itself. */
  played?: boolean;
};

export function mountMedia(el: HTMLElement, env: ViewEnv): () => void {
  const state: MediaState = loadViewState<MediaState>(env.instance);
  const list = state.media ?? [];
  let index = Math.min(Math.max(0, state.index ?? 0), Math.max(0, list.length - 1));
  let zoom: Zoom | undefined;

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

  function show(): void {
    zoom?.dispose();
    zoom = undefined;
    const m = list[index];
    if (!m) return replaceChildren(stage, h('div', { class: 'fstate muted' }, t('media.gone')));
    stage.className = `mstage k-${m.type}`;
    stage.style.background = '';
    if (m.type === 'image') {
      const img = h('img', { src: m.url, alt: m.alt ?? '', draggable: false, decoding: 'async' });
      replaceChildren(stage, img);
      zoom = zoomable(stage, img, m, {
        scale: (s) => void (scale.textContent = `${Math.round(s * 100)}%`),
        flick: (dir) => go(index + dir),
      });
    } else {
      const player = h(m.type, { src: m.url, controls: true, preload: 'metadata' });
      if (m.type === 'video') player.setAttribute('playsinline', '');
      replaceChildren(stage, player);
      if (!state.played) void player.play().catch(() => undefined);
      state.played = true;
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
    saveViewState(env.instance, state);
  }
  function go(to: number): void {
    if (to < 0 || to >= list.length || to === index) return;
    index = to;
    state.played = false;
    show();
  }

  const key = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const playing = (e.target as Element).closest?.('video, audio'); // the player has its own arrow keys
    if (e.key === 'Escape') env.close();
    else if (e.key === 'ArrowLeft' && !playing) go(index - 1);
    else if (e.key === 'ArrowRight' && !playing) go(index + 1);
    else if (e.key === '+' || e.key === '=') zoom?.by(1.25);
    else if (e.key === '-') zoom?.by(0.8);
    else if (e.key === '0') zoom?.toggle();
    else return;
    e.preventDefault();
  };
  el.addEventListener('keydown', key);
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
    else for (const p of el.querySelectorAll('video, audio')) (p as HTMLMediaElement).pause();
  };
  const off = env.visible.subscribe(front);
  return () => {
    off();
    zoom?.dispose();
    el.removeEventListener('keydown', key);
  };
}
