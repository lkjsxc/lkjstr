import type { Author, NoteRow } from '../engine/protocol.ts';
import { clockOf, dayOf, fullTime } from '../shared/format.ts';
import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { how, plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';
export const homeTitle = (name: string): string => t('home.theirs', { name });
/** A moment tab (interface-moment.md C4) is Their Home around one time, named by the author and that local time. */
export const momentTitle = (name: string, at: number): string =>
  t('moment.title', { name, time: `${dayOf(at)} ${clockOf(at)}` });

/** A note's time: where the engine serves time windows, a quiet button that opens the author's Home at that time
 * in a tab of its own (the text still opens the thread); otherwise the plain time. */
export function momentTime(row: NoteRow, env: ViewEnv, shown: Child): HTMLElement {
  const time = h('time', { title: fullTime(row.at) }, shown);
  if ((env.engine.info?.get()?.version ?? 0) < 15 || row.pending) return time;
  const name = plainName(row.author);
  const open = (event: Event): void => {
    const e = event as MouseEvent;
    e.stopPropagation();
    const state = { pubkey: row.author.pubkey, at: row.at, title: momentTitle(name, row.at) };
    env.open('their-home', state, how(e));
  };
  return h(
    'button',
    {
      class: 'tmoment',
      'aria-label': t('moment.press', { time: `${dayOf(row.at)} ${clockOf(row.at)}`, name }),
      onclick: open,
      onauxclick: (e: Event) => void ((e as MouseEvent).button === 1 && open(e)),
      onmousedown: (e: Event) => void ((e as MouseEvent).button === 1 && e.preventDefault()),
    },
    time,
  );
}
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
  state: { pubkey?: string; ref?: string; title?: string; at?: number },
  save: () => void,
  met?: (author: Author) => void,
): () => void {
  const sub = env.engine.open(
    { source: 'people', ...(state.pubkey ? { authors: [state.pubkey] } : { ref: state.ref }) },
    {
      rows: (rows) => {
        const row = rows[0];
        if (row && 'author' in row && row.author) {
          const name = plainName(row.author);
          state.title =
            typeof state.at === 'number' ? momentTitle(name, state.at) : homeTitle(name);
          met?.(row.author);
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
