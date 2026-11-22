import { afterEach, expect, it } from 'vitest';
import type { EmojiRow } from '../src/engine/protocol.ts';
import { createGrid } from '../src/views/emoji-grid.ts';
import { describe } from '../src/views/emoji-preview.ts';
import { emojiSections } from '../src/views/emoji-sections.ts';

const custom: EmojiRow[] = ['one', 'two:detail'].map((identifier, i) => ({
  kind: 'emoji',
  key: `row-${i}`,
  code: 'pien',
  set: 'Same title',
  source: `30030:${'a'.repeat(64)}:${identifier}`,
  address: `30030:${'a'.repeat(64)}:${identifier}`,
  url: `https://pictures.test/${i}.png`,
}));
afterEach(() => document.body.replaceChildren());

it.each(['search', 'frequent'])(
  '%s distinguishes same-title source collisions in names and strip',
  (section) => {
    const used = custom.map((row) => ({
      emoji: ':pien:',
      url: row.url,
      address: row.address,
      source: row.source,
      set: row.set,
    }));
    const sections = emojiSections(
      custom,
      undefined,
      used,
      section === 'search' ? ':pien' : '',
      true,
    );
    const found = sections.find(
      (value) => value.id === (section === 'search' ? 'found:custom' : 'used'),
    )!;
    const labels = ['Same title · one', 'Same title · two:detail'];
    const grid = createGrid({
      choose() {},
      preview() {},
      section() {},
      leaveTop() {},
      tone: () => 0,
    });
    try {
      grid.draw([found]);
      expect(
        [...grid.el.querySelectorAll('.ecell')].map((cell) => cell.getAttribute('aria-label')),
      ).toEqual(labels.map((label) => `:pien:, ${label}`));
      for (const [index, item] of found.items.entries()) {
        const strip = document.createElement('div');
        strip.append(...describe(item, 0));
        expect(strip.querySelector('.ecode')?.textContent).toBe(labels[index]);
        expect(item.picked.set).toBe('Same title');
      }
    } finally {
      grid.stop();
    }
  },
);

it('frequent collisions retain existing distinct source titles in the strip', () => {
  const rows = custom.map((row, i) => ({ ...row, set: ['First set', 'Second set'][i]! }));
  const used = rows.map((row) => ({
    emoji: ':pien:',
    url: row.url,
    source: row.source,
    address: row.address,
    set: row.set,
  }));
  const found = emojiSections(rows, undefined, used, '')[0]!;
  expect(found.items.map((item) => item.sourceLabel)).toEqual(['First set', 'Second set']);
  expect(found.items.map((item) => item.set)).toEqual(['First set', 'Second set']);
});
