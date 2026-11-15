import type { Author } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';
export const homeTitle = (name: string): string => t('home.theirs', { name });
export const openTheirHome = (env: ViewEnv, author: Author): void =>
  env.open('their-home', { pubkey: author.pubkey, title: homeTitle(plainName(author)) });
export const theirHomeButton = (env: ViewEnv, author: Author): HTMLElement | null =>
  (env.engine.info.get()?.version ?? 0) >= 5
    ? h(
        'button',
        { class: 'stat their-home', onclick: () => openTheirHome(env, author) },
        t('home.openTheirs'),
      )
    : null;

export function watchHomeTitle(
  env: ViewEnv,
  state: { pubkey?: string; ref?: string; title?: string },
  save: () => void,
): () => void {
  const sub = env.engine.open(
    { source: 'people', ...(state.pubkey ? { authors: [state.pubkey] } : { ref: state.ref }) },
    {
      rows: (rows) => {
        const row = rows[0];
        if (row && 'author' in row && row.author) {
          state.title = homeTitle(plainName(row.author));
          save();
          env.setTitle(state.title);
        }
      },
      patch: () => sub.window('top', 0, 1),
    },
  );
  sub.window('top', 0, 1);
  sub.visible(env.visible.get());
  const off = env.visible.subscribe((on) => sub.visible(on));
  return () => {
    off();
    sub.close();
  };
}
