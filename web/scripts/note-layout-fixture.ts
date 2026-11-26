// Browser-only synthetic row-list fixture; it never opens an engine or relay.
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { Media, NoteRow } from '../src/engine/protocol.ts';
import { h } from '../src/shared/h.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { createRowList, type RowList } from '../src/views/feed-draw.ts';
import { disposeLinkCards } from '../src/views/link-cards.ts';
import { mountMedia } from '../src/views/media.ts';
import { renderNote } from '../src/views/note.ts';
import { fitNotes } from '../src/views/note-fold.ts';
import type { ViewEnv } from '../src/views/registry.ts';

let drawn: RowList | undefined;
let list: HTMLElement;
let view: HTMLElement;
let env: ViewEnv;
let rows: NoteRow[];
const world = createWorld(1794000000000);
const source = world.notes[0];
if (!source) throw new Error('synthetic note fixture');
const base = noteRow(world, source, { me: '' });
const prepare = (count: number, width: number, native = false): void => {
  drawn?.dispose();
  if (list) disposeLinkCards(list);
  localStorage.clear();
  setLang('en');
  document.documentElement.dataset.theme = 'dark';
  list = h('div', { class: 'list' });
  view = h('div', { class: native ? 'view feed' : 'view feed has-time-rail' }, list);
  view.style.width = `${width}px`;
  view.style.height = '800px';
  document.body.replaceChildren(view);
  env = {
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
    clientWidth: view.clientWidth,
    scrollbarWidth: view.getBoundingClientRect().width - view.clientWidth,
    scrollHeight: view.scrollHeight,
    viewportHeight: view.clientHeight,
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
const boundary = async (width: number) => {
  prepare(1, width, true);
  const first = rows[0];
  if (!first) throw new Error('boundary fixture note');
  const source = 'https://fixture.invalid/preview';
  const node = renderNote(
    {
      ...first,
      previews: [{ source, url: source, kind: 'page', title: 'Synthetic link preview' }],
    },
    env,
  );
  node.dataset.key = first.key;
  list.replaceChildren(node);
  view.style.height = `${node.getBoundingClientRect().height - 32}px`;
  const before = {
    clientWidth: view.clientWidth,
    viewportHeight: view.clientHeight,
    scrollHeight: view.scrollHeight,
  };
  fitNotes([node]);
  return { before, ...(await snapshot()) };
};
const prepareWrapping = (): void => {
  prepare(1, 720);
  const row = rows[0];
  if (!row) throw new Error('wrapping fixture note');
  rows = [
    {
      ...row,
      segments: [
        { k: 'text', text: 'Rendered width changes how many lines this note uses. '.repeat(10) },
      ],
    },
  ];
  draw();
};
const resize = (width: number): void => {
  view.style.width = `${width}px`;
};
const prepareBodies = (width: number): void => {
  prepare(3, width, true);
  view.style.height = '600px';
  rows = rows.map((row, n) => ({
    ...row,
    replyTo: undefined,
    segments: [
      {
        k: 'text',
        text:
          n === 0
            ? 'Four photos from a walk.'
            : n === 1
              ? 'A short note.'
              : Array.from({ length: 13 }, (_, i) => `Line ${i + 1} of a long note.`).join('\n'),
      },
    ],
    media:
      n === 0
        ? Array.from({ length: 4 }, (_, i) => ({
            type: 'image',
            url: `/fold-image-${i}.svg?width=${width}`,
            w: 280,
            h: 480,
          }))
        : [],
  }));
  draw();
};
const prepareMedia = (media: Media[]): void => {
  prepare(2, 720);
  rows = rows.map((row) => ({
    ...row,
    segments: [{ k: 'text', text: 'Media test' }],
    media,
  }));
  draw();
};
const remountMedia = (): void => {
  drawn?.draw([]);
  draw();
};
const openMedia = (media: Media[]): void => {
  const el = h('div');
  view.append(el);
  const instance = 'layout-media';
  saveViewState(instance, { media });
  mountMedia(el, { ...env, instance, visible: createSignal(true) });
};
Object.assign(globalThis, {
  noteLayout: {
    prepare,
    draw,
    snapshot,
    repeat,
    unfold,
    counts,
    boundary,
    prepareWrapping,
    resize,
    prepareBodies,
    prepareMedia,
    remountMedia,
    openMedia,
  },
});
