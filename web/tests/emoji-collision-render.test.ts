import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Action } from '../src/engine/protocol.ts';
import { groupReactions } from '../src/shared/reactions.ts';
import { hold, sendHeld, withHeld } from '../src/views/held.ts';
import { patchNote, renderNote } from '../src/views/note.ts';
import { reactionChips } from '../src/views/note-actions.ts';
import { segments, withEmoji } from '../src/views/parts.ts';
import { note } from './public-snapshots-support.ts';
import { success, tick } from './vault-ui-fixture.ts';
import { setup } from './wishes-support.ts';

const a = 'https://first.test/pien.png';
const b = 'https://second.test/pien.png';
const setA = '30030:' + 'b'.repeat(64) + ':one';
const setB = '30030:' + 'c'.repeat(64) + ':two';
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

it('renders incoming name and body provenance without substituting a reader picture', () => {
  const x = setup();
  const incoming = { code: 'pien', url: b, address: setB, set: 'Second set' };
  const name = withEmoji(':pien:', [incoming]).find(
    (part): part is HTMLImageElement => part instanceof HTMLImageElement,
  );
  const body = segments([{ k: 'emoji', ...incoming }], x.env).find(
    (part): part is HTMLImageElement => part instanceof HTMLImageElement,
  );
  for (const image of [name, body]) {
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image?.dataset.src).toBe(b);
    expect(image?.dataset.emojiAddress).toBe(setB);
    expect(image?.dataset.emojiSet).toBe('Second set');
  }
});

it('keeps same-code reaction chips separate, including their counts, provenance and removal', async () => {
  const x = setup();
  const calls: Action[] = [];
  x.engine.act = async (action) => {
    calls.push(action);
    return success();
  };
  const reactions = [
    { emoji: ':pien:', url: a, address: setA, set: 'First set', count: 3, mine: true },
    { emoji: ':pien:', url: b, address: setB, set: 'Second set', count: 7, mine: true },
  ];
  expect(groupReactions(reactions)).toEqual(reactions);
  const chips = reactionChips({ ...note(), reactions }, x.env)!;
  x.el.append(chips);
  const buttons = [...chips.querySelectorAll<HTMLButtonElement>('.rchip')];
  expect(buttons).toHaveLength(2);
  expect(buttons.map((button) => button.textContent)).toEqual(['3', '7']);
  expect(buttons.map((button) => button.querySelector('img')?.dataset.emojiSet)).toEqual([
    'First set',
    'Second set',
  ]);
  buttons[0]!.click();
  await tick();
  expect(calls.at(-1)).toMatchObject({
    a: 'publish',
    what: { k: 'delete', of: 'reaction', emoji: ':pien:', url: a },
  });
  expect(buttons[1]?.textContent).toBe('7');
});

it('keeps pending reaction provenance on its chip but does not publish the display title', async () => {
  const calls: Action[] = [];
  const base = note('8'.repeat(64));
  hold(
    base.id,
    'a'.repeat(64),
    {
      k: 'reaction',
      emoji: ':pien:',
      url: b,
      address: setB,
      set: 'Second set',
    },
    async (action) => {
      calls.push(action);
      return success();
    },
    () => {},
  );
  expect(withHeld(base).reactions).toContainEqual(
    expect.objectContaining({
      emoji: ':pien:',
      url: b,
      address: setB,
      set: 'Second set',
      mine: true,
      count: 1,
    }),
  );
  sendHeld();
  await tick();
  expect(calls).toEqual([
    {
      a: 'publish',
      as: 'a'.repeat(64),
      what: { k: 'reaction', id: base.id, emoji: ':pien:', url: b, address: setB },
    },
  ]);
});

it('preserves the second same-code chip focus and toggle target through a note patch', async () => {
  const x = setup();
  const calls: Action[] = [];
  x.engine.act = async (action) => {
    calls.push(action);
    return success();
  };
  const row = {
    ...note(),
    reactions: [
      { emoji: ':pien:', url: a, count: 3, mine: true },
      { emoji: ':pien:', url: b, count: 7, mine: true },
    ],
  };
  const rendered = renderNote(row, x.env);
  x.el.append(rendered);
  rendered.querySelectorAll<HTMLButtonElement>('.chips .rchip')[1]!.focus();
  patchNote(rendered, { ...row, counts: { ...row.counts, replies: 4 } }, x.env);
  const focused = document.activeElement as HTMLButtonElement;
  expect(focused.getAttribute('data-emoji-url')).toBe(b);
  focused.click();
  await tick();
  expect(calls.at(-1)).toMatchObject({
    a: 'publish',
    what: { k: 'delete', of: 'reaction', emoji: ':pien:', url: b },
  });
});
