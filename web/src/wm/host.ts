// The page frame: the top bar, the tiling area below it and the overlay layer for menus and drag previews.
// (ytenrich mounts the same three parts in a shadow root over YouTube; lkjstr owns the page, so they sit in <body>.)
import { h } from '../shared/h.ts';
import type { Settings } from '../shared/settings.ts';
import { keepPageInPlace } from './page-viewport.ts';

const TAB_MIN_PX = 88; // the narrowest a fixed-width tab gets: a few characters and its close button

export type Host = {
  readonly bar: HTMLElement;
  readonly root: HTMLElement;
  readonly layer: HTMLElement;
  /** Applies the UI scale, the tab bar scale, the fixed tab width and the reading sizes. */
  look(s: Settings): void;
  dispose(): void;
};

export function createHost(): Host {
  const bar = h('header', { class: 'bar' });
  const root = h('div', { class: 'wm' });
  const layer = h('div', { class: 'layer' });
  const app = h('div', { class: 'app' }, bar, h('div', { class: 'stage' }, root, layer));
  document.body.append(app);
  const offPage = keepPageInPlace();
  return {
    bar,
    root,
    layer,
    look(s) {
      const st = document.documentElement.style;
      st.setProperty('--scale', String(s.uiScale));
      st.setProperty('--tab-scale', String(s.tabScale));
      st.setProperty('--tab-w', s.tabWidth ? `${s.tabWidth}px` : 'auto');
      // One width for every tab; on a phone a bar without room narrows them all alike, to TAB_MIN_PX, then scrolls.
      st.setProperty('--tab-flex', s.tabWidth ? `0 1 ${s.tabWidth}px` : 'none');
      st.setProperty('--tab-min', s.tabWidth ? `${Math.min(s.tabWidth, TAB_MIN_PX)}px` : 'auto');
      st.setProperty('--text', `${s.textSize}px`);
      st.setProperty('--avatar', `${s.avatarSize}px`);
      st.setProperty('--media-h', `${s.mediaHeight}px`);
      st.setProperty('--fold', String(s.foldLines));
      if (s.theme === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = s.theme;
    },
    dispose: () => (offPage(), app.remove()),
  };
}
