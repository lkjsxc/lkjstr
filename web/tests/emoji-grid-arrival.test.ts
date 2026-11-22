import { afterEach, expect, it } from 'vitest';
import type { EmojiRow } from '../src/engine/protocol.ts';
import { createGrid } from '../src/views/emoji-grid.ts';
import type { Item } from '../src/views/emoji-preview.ts';
import { emojiSections } from '../src/views/emoji-sections.ts';

const owner = 'a'.repeat(64);
const own = `10030:${owner}:`;
const main = `30030:${owner}:main`;
const late = `30030:${owner}:late`;
const row = (source: string, set: string, code: string, url: string): EmojiRow => ({
  kind: 'emoji',
  key: JSON.stringify([source, code, url]),
  source,
  set,
  code,
  url,
  ...(set ? { address: source } : {}),
});
const cat = row(own, '', 'cat', 'https://emoji.invalid/cat.png');
const dog = row(main, 'Main set', 'dog', 'https://emoji.invalid/dog.png');
const arrived = [
  row(late, 'Late set', 'pien', 'https://emoji.invalid/pien-two.png'),
  row(late, 'Late set', 'pien', 'https://emoji.invalid/pien-one.png'),
];

afterEach(() => document.body.replaceChildren());

function open() {
  const chosen: Item[] = [];
  const grid = createGrid({
    choose: (item) => chosen.push(item),
    preview() {},
    section() {},
    leaveTop() {},
    tone: () => 0,
  });
  document.body.append(grid.el);
  const cellOf = (source: string, code: string): HTMLElement | null =>
    grid.el.querySelector(`.egroup[data-section="${source}"] .ecell[aria-label^=":${code}:"]`);
  /** The picture cannot be had: the cell falls back to its code. */
  const settle = (cell: HTMLElement | null): void =>
    void cell?.querySelector('img')?.dispatchEvent(new Event('error'));
  return { grid, chosen, cellOf, settle };
}

it('a late set leaves the settled pictures it does not change in place', () => {
  const { grid, chosen, cellOf, settle } = open();
  try {
    grid.draw(emojiSections([cat, dog], undefined, [], ''));
    const before = [cellOf(own, 'cat'), cellOf(main, 'dog')];
    for (const cell of before) settle(cell);
    expect(before.map((cell) => cell?.textContent)).toEqual([':cat:', ':dog:']);
    // The late set's rows land ahead of the main set, so every later index moves.
    grid.draw(emojiSections([cat, ...arrived, dog], undefined, [], ''), true);
    const after = [cellOf(own, 'cat'), cellOf(main, 'dog')];
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    for (const [i, cell] of after.entries()) {
      expect(cell?.isConnected).toBe(true);
      expect(cell?.querySelector('img')).toBeNull();
      expect(cell?.querySelector('.efail')?.textContent).toBe([':cat:', ':dog:'][i]);
    }
    // The changed cells are new and load as before.
    const fresh = [...grid.el.querySelectorAll(`.egroup[data-section="${late}"] .ecell`)];
    expect(fresh.map((cell) => cell.querySelector('img')?.getAttribute('src'))).toEqual(
      arrived.map((r) => r.url),
    );
    expect(grid.el.querySelectorAll('.ecell[tabindex="0"]')).toHaveLength(1);
    after[1]?.click();
    expect(chosen.map((item) => item.picked.source)).toEqual([main]);
  } finally {
    grid.stop();
  }
});

it('a changed picture gets a new cell and a removed one leaves', () => {
  const { grid, cellOf, settle } = open();
  try {
    grid.draw(emojiSections([cat, dog], undefined, [], ''));
    const before = [cellOf(own, 'cat'), cellOf(main, 'dog')];
    for (const cell of before) settle(cell);
    const moved = { ...dog, url: 'https://emoji.invalid/dog-2.png' };
    grid.draw(emojiSections([moved], undefined, [], ''), true);
    const dogNow = cellOf(main, 'dog');
    expect(dogNow).not.toBe(before[1]);
    expect(dogNow?.querySelector('img')?.getAttribute('src')).toBe(moved.url);
    expect(before.map((cell) => cell?.isConnected)).toEqual([false, false]);
    expect(cellOf(own, 'cat')).toBeNull();
  } finally {
    grid.stop();
  }
});
