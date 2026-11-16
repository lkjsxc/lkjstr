// Browser-only synthetic row-list fixture; it never opens an engine or relay.
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { NoteRow } from '../src/engine/protocol.ts';
import { h } from '../src/shared/h.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { createRowList, type RowList } from '../src/views/feed-draw.ts';
import type { ViewEnv } from '../src/views/registry.ts';

let drawn: RowList | undefined;
let list: HTMLElement;
let rows: NoteRow[];
const world = createWorld(1794000000000);
const source = world.notes[0];
if (!source) throw new Error('synthetic note fixture');
const base = noteRow(world, source, { me: '' });
const prepare = (count: number, width: number): void => {
  drawn?.dispose();
  localStorage.clear();
  setLang('en');
  document.documentElement.dataset.theme = 'dark';
  list = h('div', { class: 'list' });
  const view = h('div', { class: 'view feed has-time-rail' }, list);
  view.style.width = `${width}px`;
  view.style.height = '800px';
  document.body.replaceChildren(view);
  const env = {
    instance: 'layout-browser',
    settings: createSettings(),
    engine: { accounts: createSignal({ accounts: [] }) },
  } as unknown as ViewEnv;
  drawn = createRowList(list, env, false);
  rows = Array.from(
    { length: count },
    (_, n): NoteRow => ({
      ...base,
      key: `layout-${n}`,
      id: `layout-${n}`,
      hidden: undefined,
      cw: undefined,
      author: { ...base.author, picture: undefined },
      segments: Array.from({ length: 28 }, (_, line) => ({
        k: 'text',
        text: `Synthetic note ${n}, line ${line}: bounded geometry measurement.\n`,
      })),
      media: [],
      quotes: [],
      previews: undefined,
      replyTo: undefined,
      repostedBy: undefined,
    }),
  );
  // Complete the fixture's setup layout before the tested draw begins.
  void view.offsetHeight;
};
const draw = (): { elapsedMs: number } => {
  const start = performance.now();
  drawn?.draw(rows);
  return { elapsedMs: performance.now() - start };
};
const snapshot = async () => {
  const bytes = new TextEncoder().encode(list.outerHTML);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return {
    domSha256: [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    notes: list.querySelectorAll('.note').length,
    folds: list.querySelectorAll('.fold').length,
    labels: [...new Set([...list.querySelectorAll('.fold')].map((node) => node.textContent))],
    rows: [...list.children].map((node) => ({
      key: (node as HTMLElement).dataset.key,
      height: node.getBoundingClientRect().height,
    })),
  };
};
const repeat = (): void => drawn?.draw(rows);
const unfold = (): void => list.querySelector<HTMLButtonElement>('.fold')?.click();
const counts = (): void => {
  rows = rows.map((row) => ({ ...row, counts: { ...row.counts, replies: 8 } }));
  drawn?.draw(rows);
};
Object.assign(globalThis, { noteLayout: { prepare, draw, snapshot, repeat, unfold, counts } });
