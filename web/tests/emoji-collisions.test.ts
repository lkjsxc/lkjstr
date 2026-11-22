import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EmojiRow } from '../src/engine/protocol.ts';
import { insertDraftEmoji } from '../src/shared/emoji-draft.ts';
import { withPick } from '../src/shared/emoji-used.ts';
import { t } from '../src/shared/i18n.ts';
import { createGrid } from '../src/views/emoji-grid.ts';
import { describe as describeEmoji } from '../src/views/emoji-preview.ts';
import { emojiSections } from '../src/views/emoji-sections.ts';

const a = 'https://first.test/pien.png';
const b = 'https://second.test/pien.png';
const own = `10030:${'a'.repeat(64)}:`;
const setA = `30030:${'b'.repeat(64)}:one`;
const setB = `30030:${'c'.repeat(64)}:two`;
const row = (source: string, set: string, url: string): EmojiRow => ({
  kind: 'emoji',
  key: JSON.stringify([source, 'pien', url]),
  source,
  set,
  code: 'pien',
  url,
  ...(set ? { address: source } : {}),
});
const custom = [row(own, '', a), row(setA, 'First set', b), row(setB, 'Second set', b)];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
  localStorage.clear();
});

it('keeps every source in its group, and search keeps the first source per code and picture', () => {
  const groups = emojiSections(custom, undefined, [], '');
  expect(
    groups
      .filter((group) => group.cat === 'custom')
      .flatMap((group) => group.items)
      .map((item) => item.picked.source),
  ).toEqual([own, setA, setB]);
  const found = emojiSections(custom, undefined, [], ':pien', true);
  const matches = found.find((group) => group.id === 'found:custom')!.items;
  expect(matches.map((item) => [item.picked.url, item.picked.source])).toEqual([
    [a, own],
    [b, setA],
  ]);
  const bySet = emojiSections(custom, undefined, [], 'Second set', true);
  expect(bySet.find((group) => group.id === 'found:custom')?.items[0]?.picked.source).toBe(setA);
  const grid = createGrid({
    choose() {},
    preview() {},
    section() {},
    leaveTop() {},
    tone: () => 0,
  });
  try {
    grid.draw(found);
    expect(
      [...grid.el.querySelectorAll('.ecell')].map((cell) => cell.getAttribute('aria-label')),
    ).toEqual([`:pien:, ${t('emoji.mine')}`, ':pien:, First set']);
    const preview = document.createElement('div');
    preview.append(...describeEmoji(matches[1]!, 0));
    expect(preview.querySelector('.ecode')?.textContent).toBe('First set');
  } finally {
    grid.stop();
  }
});

it('keeps source identity in frequency, even for the same shortcode and picture', () => {
  const first = { emoji: ':pien:', url: b, source: setA, address: setA, set: 'First set' };
  const second = { ...first, source: setB, address: setB, set: 'Second set' };
  const used = withPick(withPick(withPick([], first, 1), second, 2), first, 3);
  expect(used).toHaveLength(2);
  expect(used.map((entry) => [entry.source, entry.n])).toEqual([
    [setA, 2],
    [setB, 1],
  ]);
  const frequent = emojiSections(custom, undefined, [second], '')[0]!.items[0]!;
  expect(frequent.set).toBe('Second set');
  expect(frequent.picked.address).toBe(setB);
});

it('allocates suffixes without changing previous tags, and reuses an existing picture alias', () => {
  const first = insertDraftEmoji(undefined, { emoji: ':pien:', url: a, address: setA });
  const second = insertDraftEmoji(first.emoji, { emoji: ':pien:', url: b, address: setB });
  const third = insertDraftEmoji(second.emoji, {
    emoji: ':pien:',
    url: 'https://third.test/p.png',
  });
  expect([first.text, second.text, third.text]).toEqual([':pien:', ':pien_2:', ':pien_3:']);
  expect(third.emoji).toEqual([
    { code: 'pien', url: a, address: setA },
    { code: 'pien_2', url: b, address: setB },
    { code: 'pien_3', url: 'https://third.test/p.png' },
  ]);
  const again = insertDraftEmoji(third.emoji, { emoji: ':pien:', url: b, address: setB });
  expect(again.text).toBe(':pien_2:');
  expect(again.emoji).toBe(third.emoji);
  expect(first.emoji).toEqual([{ code: 'pien', url: a, address: setA }]);
});

it('does not overwrite a separately used suffix or alter Unicode picks', () => {
  const existing = [
    { code: 'pien', url: a },
    { code: 'pien_2', url: 'https://reserved.test/p.png' },
  ];
  const picked = insertDraftEmoji(existing, { emoji: ':pien:', url: b });
  expect(picked.text).toBe(':pien_3:');
  expect(picked.emoji.slice(0, 2)).toEqual(existing);
  expect(insertDraftEmoji(existing, { emoji: '🥺' })).toEqual({ text: '🥺', emoji: existing });
});

it('uses required source identity when titles or provenance addresses coincide', () => {
  const values = [{ ...row(setA, '', a), address: setB }, row(setB, '', b)];
  const groups = emojiSections(values, undefined, [], '').filter((group) => group.cat === 'custom');
  expect(groups.map((group) => group.id)).toEqual([setA, setB]);
  expect(groups.every((group) => group.label !== t('emoji.mine'))).toBe(true);
});

it('reuses an alias beyond a free gap and keeps new aliases within the code bound', () => {
  const existing = [
    { code: 'pien', url: a },
    { code: 'pien_3', url: b },
  ];
  const reused = insertDraftEmoji(existing, { emoji: ':pien:', url: b });
  expect(reused.text).toBe(':pien_3:');
  expect(reused.emoji).toBe(existing);
  const base = 'a'.repeat(64);
  const original = [{ code: base, url: a }];
  const next = insertDraftEmoji(original, { emoji: `:${base}:`, url: b });
  expect(next.emoji[1]?.code).toBe(`${'a'.repeat(62)}_2`);
  expect(next.emoji[1]?.code.length).toBe(64);
  expect(next.emoji[0]).toEqual(original[0]);
  expect(insertDraftEmoji(next.emoji, { emoji: `:${base}:`, url: b }).text).toBe(next.text);
});
