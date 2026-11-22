// Quote writes in the Post tab (wm/open-tab.ts) with the quoted note as a card under the field, and the composer's
// content warning goes out with the note (compose-cw.ts).
import { afterEach, expect, it } from 'vitest';
import type { Action } from '../src/engine/protocol.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountCompose } from '../src/views/compose.ts';
import type { Quoted } from '../src/views/compose-context.ts';
import * as L from '../src/wm/layout.ts';
import { createOpener } from '../src/wm/open-tab.ts';
import { person, setup } from './wishes-support.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

const quoteOf: Quoted = {
  author: person,
  at: Date.now() - 60_000,
  text: 'the quoted words',
  media: 2,
};
const QUOTE = { quote: 'f'.repeat(64), quoteOf };

/** A controller's parts around `layout`, with each tab's stored state in `held`. */
function opener(layout: L.LayoutNode, held: Record<string, object> = {}) {
  let root = layout;
  let n = 1;
  const shown: string[] = [];
  const revived: Record<string, object> = {};
  const o = createOpener({
    root: () => root,
    touched: () => '',
    touch: () => undefined,
    set: (next) => void (root = next),
    show: (tab) => void shown.push(tab),
    own: {
      fresh: (kind) => `${kind}~${++n}`,
      held: (tab) => held[tab] ?? {},
      unmount: () => undefined,
      revive: (tab, state) => ((revived[tab] = state ?? {}), true),
    },
  });
  return { o, shown, revived, root: () => root };
}
const row = (...tiles: string[][]): L.LayoutNode =>
  L.split(
    'row',
    tiles.map((t) => L.pane(t)),
  );
const tiles = (root: L.LayoutNode): string[] =>
  L.panes(root).map((p) => p.tabs.map((t) => (t === p.active ? `${t}*` : t)).join(' '));

it('a quote goes to the open Post tab when it holds nothing, the read tile staying as it was', () => {
  const x = opener(row(['home'], ['compose']), { compose: { text: '  ' } });
  x.o.from('home')('compose', QUOTE);
  expect(x.revived.compose).toMatchObject(QUOTE);
  expect(x.shown).toEqual(['compose']);
  expect(tiles(x.root())).toEqual(['home*', 'compose*']);
});

it('a Post tab with a draft keeps it: the quote opens a new Post tab next to it', () => {
  const x = opener(row(['home'], ['compose', 'account']), { compose: { text: 'mine' } });
  x.o.from('home')('compose', QUOTE);
  expect(Object.keys(x.revived)).toEqual([]);
  expect(tiles(x.root())).toEqual(['home*', 'compose compose~2* account']);
});

it('with no Post tab the quote opens in the neighbouring tile, or right after the read tab when alone', () => {
  const two = opener(row(['home'], ['notifications']));
  two.o.from('home')('compose', QUOTE);
  expect(tiles(two.root())).toEqual(['home*', 'notifications compose~2*']);
  const one = opener(L.pane(['home', 'global']));
  one.o.from('home')('compose', QUOTE);
  expect(tiles(one.root())).toEqual(['home compose~2* global']);
});

it('other tabs still open right after the one they came from', () => {
  const x = opener(row(['home', 'global'], ['compose']));
  x.o.from('home')('thread', { id: 'a' });
  expect(tiles(x.root())).toEqual(['home thread~2* global', 'compose*']);
});

it('the composer shows the quoted note as a card that × takes off', () => {
  const x = setup();
  saveViewState(x.env.instance, QUOTE);
  mountCompose(x.el, x.env);
  const card = x.el.querySelector('.cquote') as HTMLElement;
  expect(card.querySelector('.qtext')?.textContent).toBe('the quoted words');
  expect(card.querySelector('.name')?.textContent).toBe('Alice');
  expect(card.querySelector('.qmedia')?.textContent).toBe('2');
  (card.querySelector('.x') as HTMLButtonElement).click();
  expect(x.el.querySelector('.cquote')).toBeNull();
});

it('a quoted note with a warning shows the warning, not its words', () => {
  const x = setup();
  saveViewState(x.env.instance, { ...QUOTE, quoteOf: { ...quoteOf, cw: 'spoilers' } });
  mountCompose(x.el, x.env);
  const card = x.el.querySelector('.cquote') as HTMLElement;
  expect(card.textContent).toContain('Content warning: spoilers');
  expect(card.querySelector('.qtext')).toBeNull();
});

it('a quote posts with no text, and a content warning goes out with its reason', async () => {
  const x = setup();
  saveViewState(x.env.instance, QUOTE);
  mountCompose(x.el, x.env);
  const warn = x.el.querySelector('.cbar .icon:has(.i-warn)') as HTMLButtonElement;
  const reason = x.el.querySelector('.ccw') as HTMLInputElement;
  expect(reason.hidden).toBe(true);
  warn.click();
  expect(reason.hidden).toBe(false);
  expect(warn.classList.contains('on')).toBe(true);
  reason.value = 'spoilers';
  reason.dispatchEvent(new Event('input'));
  (x.el.querySelector('.primary') as HTMLButtonElement).click();
  await Promise.resolve();
  const sent = x.act.mock.calls.at(-1) as unknown as [Action] | undefined;
  expect(sent?.[0]).toMatchObject({
    a: 'publish',
    what: { k: 'note', draft: { text: '', quote: QUOTE.quote, cw: 'spoilers' } },
  });
  expect(reason.hidden).toBe(true);
  expect(x.el.querySelector('.cquote')).toBeNull();
});

it('a warning turned off sends nothing about it', async () => {
  const x = setup();
  mountCompose(x.el, x.env);
  const warn = x.el.querySelector('.cbar .icon:has(.i-warn)') as HTMLButtonElement;
  warn.click();
  warn.click();
  const field = x.el.querySelector('textarea') as HTMLTextAreaElement;
  field.value = 'plain';
  field.dispatchEvent(new Event('input'));
  (x.el.querySelector('.primary') as HTMLButtonElement).click();
  await Promise.resolve();
  const sent = x.act.mock.calls.at(-1) as unknown as [Action] | undefined;
  expect(JSON.stringify(sent?.[0])).not.toContain('"cw"');
});
