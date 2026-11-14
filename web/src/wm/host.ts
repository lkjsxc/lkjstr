// The page frame: the top bar, the tiling area below it and the overlay layer for menus and drag previews.
// (ytenrich mounts the same three parts in a shadow root over YouTube; lkjstr owns the page, so they sit in <body>.)
import { h } from '../shared/h.ts';
import type { Settings } from '../shared/settings.ts';

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
  return {
    bar,
    root,
    layer,
    look(s) {
      const st = document.documentElement.style;
      st.setProperty('--scale', String(s.uiScale));
      st.setProperty('--tab-scale', String(s.tabScale));
      st.setProperty('--tab-w', s.tabWidth ? `${s.tabWidth}px` : 'auto');
      st.setProperty('--text', `${s.textSize}px`);
      st.setProperty('--avatar', `${s.avatarSize}px`);
      st.setProperty('--media-h', `${s.mediaHeight}px`);
      st.setProperty('--fold', String(s.foldLines || 9999));
      if (s.theme === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = s.theme;
    },
    dispose: () => app.remove(),
  };
}
