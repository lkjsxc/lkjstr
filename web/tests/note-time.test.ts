import { afterEach, expect, it, vi } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import { clockOf, dayOf, fullTime } from '../src/shared/format.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const now = new Date(2026, 10, 15, 12).getTime();
const world = createWorld(now);
const base = noteRow(world, world.notes[0]!, { me: '' });
const setup = (dated = true) => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const settings = createSettings();
  const env = {
    instance: 'note-time',
    settings,
    engine: { accounts: createSignal({ accounts: [] }) },
  } as unknown as ViewEnv;
  const list = document.createElement('div');
  const rows = createRowList(list, env, dated);
  const time = () => list.querySelector('time');
  return { settings, rows, list, time };
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  setLang('en');
});

it.each(['en', 'ja'] as const)('honors relative time in dated feeds (%s)', (lang) => {
  setLang(lang);
  const { settings, rows, time } = setup();
  const note = { ...base, at: now - 3 * 60_000, repostedBy: undefined };
  rows.draw([note]);
  expect(time()?.textContent).toBe(clockOf(note.at));
  settings.patch({ relativeTime: true });
  rows.clear(); // Feed settings changes invalidate the rendered rows.
  rows.draw([note]);
  expect(time()?.textContent).toBe(lang === 'ja' ? '3分前' : '3m');
  const head = time()?.parentElement;
  rows.draw([{ ...note, counts: { ...note.counts, replies: 9 } }]);
  expect(time()?.parentElement).not.toBe(head);
  expect(time()?.textContent).toBe(lang === 'ja' ? '3分前' : '3m');
  expect(time()?.title).toBe(fullTime(note.at));
  settings.patch({ relativeTime: false });
  rows.clear();
  rows.draw([note]);
  expect(time()?.textContent).toBe(clockOf(note.at));
  rows.dispose();
  settings.dispose();
});

it.each([
  [new Date(2020, 0, 2, 9, 5).getTime(), new Date(2026, 10, 14, 8).getTime()],
  [new Date(2026, 10, 14, 23, 59).getTime(), new Date(2026, 10, 15, 0, 1).getTime()],
  [now, new Date(2026, 10, 16, 0, 1).getTime()],
])('retains the original date across repost days (%s, %s)', (at, repostAt) => {
  const { settings, rows, list, time } = setup();
  const note = { ...base, at, repostedBy: { at: repostAt, actors: [base.author], others: 0 } };
  rows.draw([note]);
  if (dayOf(repostAt) !== dayOf(now))
    expect(list.querySelector('.day')?.textContent).toBe(dayOf(repostAt));
  const expected = `${dayOf(at)} ${clockOf(at)}`;
  expect(time()?.textContent).toBe(expected);
  rows.draw([{ ...note, author: { ...note.author, name: 'Updated name' } }]);
  expect(time()?.textContent).toBe(expected);
  expect(time()?.title).toBe(fullTime(at));
  rows.dispose();
  settings.dispose();
});

it('shortens same-day reposts and measures relative age from authorship', () => {
  const { settings, rows, time } = setup();
  const at = now - 2 * 86_400_000;
  const note = { ...base, at, repostedBy: { at: at + 60_000, actors: [base.author], others: 0 } };
  rows.draw([note]);
  expect(time()?.textContent).toBe(clockOf(at));
  settings.patch({ relativeTime: true });
  rows.clear();
  rows.draw([note]);
  expect(time()?.textContent).toBe('2d');
  rows.dispose();
  settings.dispose();
});
